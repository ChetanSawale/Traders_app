import { pool } from '../db/db';
import { feedEvents, TickerPrice } from './liveFeeds';

export interface DbOrder {
  id: number;
  portfolio_id: number;
  ticker: string;
  quantity: number;
  price: number | null;
  type: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL' | 'SELL_SHORT' | 'BUY_TO_COVER';
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  stop_loss: number | null;
  take_profit: number | null;
  created_at: Date;
}

export interface DbPosition {
  id: number;
  portfolio_id: number;
  ticker: string;
  quantity: number;
  average_entry_price: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
  stop_loss: number | null;
  take_profit: number | null;
}

const COMMISSION_RATE = 0.0005; // 0.05% commission

export async function processOrderFill(order: DbOrder, fillPrice: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the order and verify it's still pending
    const orderRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [order.id]
    );
    if (orderRes.rows.length === 0) {
      throw new Error(`Order ${order.id} not found`);
    }
    const currentOrder = orderRes.rows[0] as DbOrder;
    if (currentOrder.status !== 'PENDING') {
      console.log(`Order ${order.id} is already processed: ${currentOrder.status}`);
      await client.query('COMMIT');
      return;
    }

    // 2. Lock the portfolio
    const portfolioRes = await client.query(
      'SELECT * FROM portfolios WHERE id = $1 FOR UPDATE',
      [order.portfolio_id]
    );
    if (portfolioRes.rows.length === 0) {
      throw new Error(`Portfolio ${order.portfolio_id} not found`);
    }
    const portfolio = portfolioRes.rows[0];
    let cashBalance = parseFloat(portfolio.cash_balance);

    const quantity = parseFloat(order.quantity.toString());
    const tradeValue = quantity * fillPrice;
    const commission = tradeValue * COMMISSION_RATE;
    const totalCost = tradeValue + commission;

    // 3. Handle cash adjustment and position updates based on trade side
    if (order.side === 'BUY') {
      // LONG Open
      if (cashBalance < totalCost) {
        // Insufficient funds: Cancel the order
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['CANCELLED', order.id]
        );
        console.log(`Order ${order.id} cancelled due to insufficient funds.`);
        await client.query('COMMIT');
        return;
      }

      // Deduct cash
      cashBalance -= totalCost;
      await client.query(
        'UPDATE portfolios SET cash_balance = $1 WHERE id = $2',
        [cashBalance, order.portfolio_id]
      );

      // Upsert position
      const posRes = await client.query(
        'SELECT * FROM positions WHERE portfolio_id = $1 AND ticker = $2 AND side = $3 FOR UPDATE',
        [order.portfolio_id, order.ticker, 'LONG']
      );

      if (posRes.rows.length > 0) {
        const existing = posRes.rows[0];
        const existingQty = parseFloat(existing.quantity.toString());
        const existingAvg = parseFloat(existing.average_entry_price.toString());

        const newQty = existingQty + quantity;
        const newAvg = ((existingQty * existingAvg) + tradeValue) / newQty;

        await client.query(
          `UPDATE positions 
           SET quantity = $1, average_entry_price = $2, stop_loss = $3, take_profit = $4 
           WHERE id = $5`,
          [newQty, newAvg, order.stop_loss, order.take_profit, existing.id]
        );
      } else {
        await client.query(
          `INSERT INTO positions (portfolio_id, ticker, quantity, average_entry_price, side, stop_loss, take_profit) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [order.portfolio_id, order.ticker, quantity, fillPrice, 'LONG', order.stop_loss, order.take_profit]
        );
      }
    } else if (order.side === 'SELL') {
      // LONG Close
      const posRes = await client.query(
        'SELECT * FROM positions WHERE portfolio_id = $1 AND ticker = $2 AND side = $3 FOR UPDATE',
        [order.portfolio_id, order.ticker, 'LONG']
      );

      if (posRes.rows.length === 0) {
        // No position to sell: Cancel the order
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['CANCELLED', order.id]
        );
        console.log(`Order ${order.id} cancelled: No active LONG position found.`);
        await client.query('COMMIT');
        return;
      }

      const existing = posRes.rows[0];
      const existingQty = parseFloat(existing.quantity.toString());

      if (existingQty < quantity) {
        // Not enough quantity: Cancel the order
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['CANCELLED', order.id]
        );
        console.log(`Order ${order.id} cancelled: Insufficient position quantity.`);
        await client.query('COMMIT');
        return;
      }

      // Add proceeds to cash balance (proceeds minus commission)
      const proceeds = tradeValue - commission;
      cashBalance += proceeds;
      await client.query(
        'UPDATE portfolios SET cash_balance = $1 WHERE id = $2',
        [cashBalance, order.portfolio_id]
      );

      // Update or delete position
      if (existingQty === quantity) {
        await client.query('DELETE FROM positions WHERE id = $1', [existing.id]);
      } else {
        const newQty = existingQty - quantity;
        await client.query(
          'UPDATE positions SET quantity = $1 WHERE id = $2',
          [newQty, existing.id]
        );
      }
    } else if (order.side === 'SELL_SHORT') {
      // SHORT Open (Credits cash, increases liabilities)
      const marginRequirement = tradeValue * 0.5; // 50% margin requirement
      if (cashBalance < marginRequirement + commission) {
        // Insufficient margin
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['CANCELLED', order.id]
        );
        console.log(`Order ${order.id} cancelled: Insufficient margin.`);
        await client.query('COMMIT');
        return;
      }

      // Add short sale cash proceeds minus commission
      cashBalance += (tradeValue - commission);
      await client.query(
        'UPDATE portfolios SET cash_balance = $1 WHERE id = $2',
        [cashBalance, order.portfolio_id]
      );

      // Upsert position
      const posRes = await client.query(
        'SELECT * FROM positions WHERE portfolio_id = $1 AND ticker = $2 AND side = $3 FOR UPDATE',
        [order.portfolio_id, order.ticker, 'SHORT']
      );

      if (posRes.rows.length > 0) {
        const existing = posRes.rows[0];
        const existingQty = parseFloat(existing.quantity.toString());
        const existingAvg = parseFloat(existing.average_entry_price.toString());

        const newQty = existingQty + quantity;
        const newAvg = ((existingQty * existingAvg) + tradeValue) / newQty;

        await client.query(
          `UPDATE positions 
           SET quantity = $1, average_entry_price = $2, stop_loss = $3, take_profit = $4 
           WHERE id = $5`,
          [newQty, newAvg, order.stop_loss, order.take_profit, existing.id]
        );
      } else {
        await client.query(
          `INSERT INTO positions (portfolio_id, ticker, quantity, average_entry_price, side, stop_loss, take_profit) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [order.portfolio_id, order.ticker, quantity, fillPrice, 'SHORT', order.stop_loss, order.take_profit]
        );
      }
    } else if (order.side === 'BUY_TO_COVER') {
      // SHORT Close (Buys back borrowed stock to close position)
      const posRes = await client.query(
        'SELECT * FROM positions WHERE portfolio_id = $1 AND ticker = $2 AND side = $3 FOR UPDATE',
        [order.portfolio_id, order.ticker, 'SHORT']
      );

      if (posRes.rows.length === 0) {
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['CANCELLED', order.id]
        );
        console.log(`Order ${order.id} cancelled: No active SHORT position found.`);
        await client.query('COMMIT');
        return;
      }

      const existing = posRes.rows[0];
      const existingQty = parseFloat(existing.quantity.toString());

      if (existingQty < quantity) {
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['CANCELLED', order.id]
        );
        console.log(`Order ${order.id} cancelled: Insufficient short quantity to cover.`);
        await client.query('COMMIT');
        return;
      }

      // Deduct repurchase cost + commission
      cashBalance -= totalCost;
      await client.query(
        'UPDATE portfolios SET cash_balance = $1 WHERE id = $2',
        [cashBalance, order.portfolio_id]
      );

      // Update or delete position
      if (existingQty === quantity) {
        await client.query('DELETE FROM positions WHERE id = $1', [existing.id]);
      } else {
        const newQty = existingQty - quantity;
        await client.query(
          'UPDATE positions SET quantity = $1 WHERE id = $2',
          [newQty, existing.id]
        );
      }
    }

    // 4. Update Order Status
    await client.query(
      'UPDATE orders SET status = $1, price = $2 WHERE id = $3',
      ['FILLED', fillPrice, order.id]
    );

    // 5. Create Transaction Log entry
    await client.query(
      `INSERT INTO transactions (portfolio_id, ticker, quantity, price, side, commission) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [order.portfolio_id, order.ticker, quantity, fillPrice, order.side, commission]
    );

    await client.query('COMMIT');
    console.log(`Order ${order.id} FILLED successfully at price $${fillPrice}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to process order fill for order ${order.id}:`, error);
  } finally {
    client.release();
  }
}

// Evaluate limits and SL/TP bounds on every price tick
async function evaluateOrdersAndPositions(tick: TickerPrice) {
  try {
    // A. Evaluate Pending Limit/Market Orders
    const pendingOrdersRes = await pool.query(
      `SELECT * FROM orders 
       WHERE status = 'PENDING' AND ticker = $1`,
      [tick.ticker]
    );

    const orders = pendingOrdersRes.rows as DbOrder[];
    for (const order of orders) {
      if (order.type === 'MARKET') {
        // Market orders execute immediately on tick
        await processOrderFill(order, tick.price);
      } else if (order.type === 'LIMIT' && order.price !== null) {
        const orderPrice = parseFloat(order.price.toString());
        
        if (order.side === 'BUY' || order.side === 'BUY_TO_COVER') {
          if (tick.price <= orderPrice) {
            await processOrderFill(order, tick.price);
          }
        } else if (order.side === 'SELL' || order.side === 'SELL_SHORT') {
          if (tick.price >= orderPrice) {
            await processOrderFill(order, tick.price);
          }
        }
      }
    }

    // B. Evaluate Stop-Loss (SL) / Take-Profit (TP) boundaries on active positions
    const activePositionsRes = await pool.query(
      'SELECT * FROM positions WHERE ticker = $1',
      [tick.ticker]
    );

    const positions = activePositionsRes.rows as DbPosition[];
    for (const pos of positions) {
      let triggerSide: 'SELL' | 'BUY_TO_COVER' | null = null;
      let reason = '';

      const stopLoss = pos.stop_loss ? parseFloat(pos.stop_loss.toString()) : null;
      const takeProfit = pos.take_profit ? parseFloat(pos.take_profit.toString()) : null;

      if (pos.side === 'LONG') {
        if (stopLoss !== null && tick.price <= stopLoss) {
          triggerSide = 'SELL';
          reason = 'Stop-Loss Triggered';
        } else if (takeProfit !== null && tick.price >= takeProfit) {
          triggerSide = 'SELL';
          reason = 'Take-Profit Triggered';
        }
      } else if (pos.side === 'SHORT') {
        if (stopLoss !== null && tick.price >= stopLoss) {
          triggerSide = 'BUY_TO_COVER';
          reason = 'Stop-Loss Triggered';
        } else if (takeProfit !== null && tick.price <= takeProfit) {
          triggerSide = 'BUY_TO_COVER';
          reason = 'Take-Profit Triggered';
        }
      }

      if (triggerSide) {
        console.log(`Position ${pos.id} on ${pos.ticker} breached boundary. Reason: ${reason} (Price: $${tick.price})`);
        
        // Place automatic market order to close position
        const orderInsertRes = await pool.query(
          `INSERT INTO orders (portfolio_id, ticker, quantity, price, type, side, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [pos.portfolio_id, pos.ticker, pos.quantity, tick.price, 'MARKET', triggerSide, 'PENDING']
        );
        
        if (orderInsertRes.rows.length > 0) {
          const autoOrder = orderInsertRes.rows[0] as DbOrder;
          await processOrderFill(autoOrder, tick.price);
        }
      }
    }
  } catch (error) {
    console.error(`Error in matching cycle for ticker ${tick.ticker}:`, error);
  }
}

// Register live ticker feed listener
export function startMatchingEngine() {
  console.log('Registering Order Matching Engine ticker listener...');
  feedEvents.on('tick', (tick: TickerPrice) => {
    evaluateOrdersAndPositions(tick).catch(console.error);
  });
}
