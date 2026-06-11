import { FastifyInstance } from 'fastify';
import { pool } from '../db/db';
import { authenticate } from '../middleware/auth';

export async function educationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // 1. GET COURSE PROGRESS
  fastify.get('/api/education/progress', async (request, reply) => {
    const user = request.user!;
    try {
      const res = await pool.query(
        'SELECT video_url, progress_percent, updated_at FROM course_progress WHERE user_id = $1',
        [user.id]
      );
      return reply.send(res.rows);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve course progress' });
    }
  });

  // 2. SAVE COURSE PROGRESS
  fastify.post('/api/education/progress', async (request, reply) => {
    const user = request.user!;
    const { video_url, progress_percent } = request.body as any;

    if (!video_url || progress_percent === undefined) {
      return reply.status(400).send({ error: 'video_url and progress_percent are required' });
    }

    try {
      await pool.query(
        `INSERT INTO course_progress (user_id, video_url, progress_percent, updated_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
         ON CONFLICT (user_id, video_url) 
         DO UPDATE SET progress_percent = EXCLUDED.progress_percent, updated_at = CURRENT_TIMESTAMP`,
        [user.id, video_url, parseFloat(progress_percent)]
      );
      return reply.send({ success: true });
    } catch (error) {
      console.error('Error saving progress:', error);
      return reply.status(500).send({ error: 'Failed to update progress status' });
    }
  });

  // 3. GET VIDEO NOTES
  fastify.get('/api/education/notes', async (request, reply) => {
    const user = request.user!;
    const { video_url } = request.query as any;

    if (!video_url) {
      return reply.status(400).send({ error: 'video_url is required' });
    }

    try {
      const res = await pool.query(
        `SELECT id, timestamp_seconds, note_text, created_at 
         FROM course_notes 
         WHERE user_id = $1 AND video_url = $2 
         ORDER BY timestamp_seconds ASC`,
        [user.id, video_url]
      );
      return reply.send(res.rows);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve notes' });
    }
  });

  // 4. ADD VIDEO NOTE
  fastify.post('/api/education/notes', async (request, reply) => {
    const user = request.user!;
    const { video_url, timestamp_seconds, note_text } = request.body as any;

    if (!video_url || timestamp_seconds === undefined || !note_text) {
      return reply.status(400).send({ error: 'Missing required note parameters' });
    }

    try {
      const res = await pool.query(
        `INSERT INTO course_notes (user_id, video_url, timestamp_seconds, note_text) 
         VALUES ($1, $2, $3, $4) RETURNING id, timestamp_seconds, note_text, created_at`,
        [user.id, video_url, parseInt(timestamp_seconds), note_text]
      );
      return reply.send(res.rows[0]);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to save notes' });
    }
  });

  // 5. CHART QUIZ VERIFICATION
  fastify.post('/api/education/quiz', async (request, reply) => {
    const { quizId, points } = request.body as any;

    // quizId 1: Locate Support Zone.
    // Correct zone is around y-coordinate (e.g. support line between 140 and 150)
    // quizId 2: Locate Resistance Zone.
    // Correct zone is around y-coordinate (e.g. resistance line between 210 and 220)
    if (!quizId || !points || points.length === 0) {
      return reply.status(400).send({ error: 'Missing quiz parameters or coordinate points' });
    }

    try {
      const targetPoint = points[0]; // { x, y } coordinates clicked on canvas
      let isCorrect = false;

      if (quizId === 'support_zone') {
        // Mock condition: check if y-coordinate falls within support boundary (e.g., 140 to 155)
        if (targetPoint.y >= 140 && targetPoint.y <= 158) {
          isCorrect = true;
        }
      } else if (quizId === 'resistance_zone') {
        // Mock condition: check if y-coordinate falls within resistance boundary (e.g., 205 to 222)
        if (targetPoint.y >= 205 && targetPoint.y <= 222) {
          isCorrect = true;
        }
      }

      return reply.send({
        quizId,
        correct: isCorrect,
        message: isCorrect
          ? 'Excellent! You correctly identified the price reversal zone.'
          : 'Incorrect. The reversal zone lies where trading volume increases and price bounces. Please try again.',
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to verify quiz answers' });
    }
  });
}
