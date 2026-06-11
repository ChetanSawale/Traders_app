import { FastifyInstance } from 'fastify';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { pool } from '../db/db';
import { authenticate } from '../middleware/auth';
import * as dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'tradesphere-super-secret-key';
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function authRoutes(fastify: FastifyInstance) {
  // 1. REGISTER
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password, role = 'trader' } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailCheck.rows.length > 0) {
        return reply.status(400).send({ error: 'A user with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      
      // Insert user and create portfolio inside transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const userRes = await client.query(
          `INSERT INTO users (email, password_hash, role) 
           VALUES ($1, $2, $3) RETURNING id, email, role`,
          [email, passwordHash, role]
        );
        const user = userRes.rows[0];

        const portfolioRes = await client.query(
          `INSERT INTO portfolios (user_id, cash_balance, margin_balance) 
           VALUES ($1, 100000.0000, 100000.0000) RETURNING id`,
          [user.id]
        );
        const portfolioId = portfolioRes.rows[0].id;

        await client.query('COMMIT');

        // Log session
        const ip = request.ip;
        const userAgent = request.headers['user-agent'] || 'unknown';
        await pool.query(
          `INSERT INTO session_logs (user_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
          [user.id, ip, userAgent]
        );

        // Sign token
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        reply.setCookie('token', token, COOKIE_OPTIONS);

        return reply.send({ user: { id: user.id, email: user.email, role: user.role, portfolioId } });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Registration error:', error);
      return reply.status(500).send({ error: 'Internal server error during registration' });
    }
  });

  // 2. LOGIN
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userRes.rows.length === 0) {
        return reply.status(400).send({ error: 'Invalid email or password' });
      }

      const user = userRes.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.status(400).send({ error: 'Invalid email or password' });
      }

      // If MFA is enabled, require MFA verification first
      if (user.mfa_enabled) {
        const tempToken = jwt.sign({ id: user.id, email: user.email, role: user.role, mfaRequired: true }, JWT_SECRET, { expiresIn: '5m' });
        return reply.send({ mfaRequired: true, tempToken });
      }

      // Get portfolio ID
      const portRes = await pool.query('SELECT id FROM portfolios WHERE user_id = $1', [user.id]);
      const portfolioId = portRes.rows[0]?.id;

      // Log session
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] || 'unknown';
      await pool.query(
        `INSERT INTO session_logs (user_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
        [user.id, ip, userAgent]
      );

      // Sign full session token
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('token', token, COOKIE_OPTIONS);

      return reply.send({ user: { id: user.id, email: user.email, role: user.role, portfolioId } });
    } catch (error) {
      console.error('Login error:', error);
      return reply.status(500).send({ error: 'Internal server error during login' });
    }
  });

  // 3. LOGOUT
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ success: true });
  });

  // 4. MOCK GITHUB OAUTH LOGIN (For student layout demonstration)
  fastify.post('/api/auth/github', async (request, reply) => {
    const { code } = request.body as any; // Simulated authorization code
    
    // In production, exchange code for github token, fetch profile.
    // For local mockup, automatically log in as a mock GitHub student trader:
    const mockEmail = `github-student-${code || 'demo'}@tradesphere.edu`;
    const mockGithubId = `gh-${code || '12345'}`;

    try {
      let userRes = await pool.query('SELECT * FROM users WHERE github_id = $1 OR email = $2', [mockGithubId, mockEmail]);
      let user;

      if (userRes.rows.length === 0) {
        // Create user
        const passwordHash = await bcrypt.hash('github-oauth-fallback-pass', 10);
        
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const newUserRes = await client.query(
            `INSERT INTO users (email, password_hash, role, github_id) 
             VALUES ($1, $2, $3, $4) RETURNING id, email, role`,
            [mockEmail, passwordHash, 'student', mockGithubId]
          );
          user = newUserRes.rows[0];

          await client.query(
            `INSERT INTO portfolios (user_id, cash_balance, margin_balance) 
             VALUES ($1, 100000.0000, 100000.0000)`,
            [user.id]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        user = userRes.rows[0];
      }

      const portRes = await pool.query('SELECT id FROM portfolios WHERE user_id = $1', [user.id]);
      const portfolioId = portRes.rows[0]?.id;

      // Log session
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] || 'unknown';
      await pool.query(
        `INSERT INTO session_logs (user_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
        [user.id, ip, userAgent]
      );

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('token', token, COOKIE_OPTIONS);

      return reply.send({ user: { id: user.id, email: user.email, role: user.role, portfolioId } });
    } catch (error) {
      console.error('Github mock login error:', error);
      return reply.status(500).send({ error: 'Internal server error during GitHub authentication' });
    }
  });

  // 5. MFA SETUP (Generate TOTP secret and QR code)
  fastify.post('/api/auth/mfa/setup', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;
    try {
      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(user.email, 'TradeSphere', secret);
      const qrCode = await QRCode.toDataURL(otpauthUrl);

      // Save secret to database temporarily
      await pool.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, user.id]);

      return reply.send({ secret, qrCode });
    } catch (error) {
      console.error('MFA setup error:', error);
      return reply.status(500).send({ error: 'Internal server error during MFA setup' });
    }
  });

  // 6. MFA VERIFY (Enable MFA on code validation)
  fastify.post('/api/auth/mfa/verify', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;
    const { token } = request.body as any;

    try {
      const userRes = await pool.query('SELECT mfa_secret FROM users WHERE id = $1', [user.id]);
      const secret = userRes.rows[0]?.mfa_secret;

      if (!secret) {
        return reply.status(400).send({ error: 'MFA setup has not been initiated' });
      }

      const verified = authenticator.verify({ token, secret });
      if (!verified) {
        return reply.status(400).send({ error: 'Invalid MFA verification code' });
      }

      await pool.query('UPDATE users SET mfa_enabled = TRUE WHERE id = $1', [user.id]);
      return reply.send({ success: true });
    } catch (error) {
      console.error('MFA verification error:', error);
      return reply.status(500).send({ error: 'Internal server error during MFA verification' });
    }
  });

  // 7. MFA LOGIN (MFA secondary validation block)
  fastify.post('/api/auth/mfa/login', async (request, reply) => {
    const { tempToken, token } = request.body as any;

    if (!tempToken || !token) {
      return reply.status(400).send({ error: 'Token and temporary session token are required' });
    }

    try {
      const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
      if (!decoded.mfaRequired) {
        return reply.status(400).send({ error: 'Invalid temporary verification session' });
      }

      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
      if (userRes.rows.length === 0) {
        return reply.status(400).send({ error: 'User not found' });
      }

      const user = userRes.rows[0];
      const verified = authenticator.verify({ token, secret: user.mfa_secret });
      if (!verified) {
        return reply.status(400).send({ error: 'Invalid MFA token code' });
      }

      const portRes = await pool.query('SELECT id FROM portfolios WHERE user_id = $1', [user.id]);
      const portfolioId = portRes.rows[0]?.id;

      // Log session
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] || 'unknown';
      await pool.query(
        `INSERT INTO session_logs (user_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
        [user.id, ip, userAgent]
      );

      // Sign full session cookie
      const sessionToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      reply.setCookie('token', sessionToken, COOKIE_OPTIONS);

      return reply.send({ user: { id: user.id, email: user.email, role: user.role, portfolioId } });
    } catch (error) {
      console.error('MFA login error:', error);
      return reply.status(401).send({ error: 'Temporary session expired or invalid verification code' });
    }
  });

  // 8. GET SESSION AUDIT LOGS
  fastify.get('/api/auth/session-audit', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;
    try {
      const logsRes = await pool.query(
        `SELECT ip_address, user_agent, login_time 
         FROM session_logs 
         WHERE user_id = $1 
         ORDER BY login_time DESC 
         LIMIT 20`,
        [user.id]
      );
      return reply.send(logsRes.rows);
    } catch (error) {
      console.error('Audit logs fetch error:', error);
      return reply.status(500).send({ error: 'Failed to retrieve session audit logs' });
    }
  });

  // 9. CHECK AUTH STATUS
  fastify.get('/api/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;
    try {
      const portRes = await pool.query('SELECT id FROM portfolios WHERE user_id = $1', [user.id]);
      const portfolioId = portRes.rows[0]?.id;
      
      const userRes = await pool.query('SELECT mfa_enabled FROM users WHERE id = $1', [user.id]);
      const mfaEnabled = userRes.rows[0]?.mfa_enabled;

      return reply.send({ 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          portfolioId,
          mfaEnabled 
        } 
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error checking profile' });
    }
  });
}
