import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'tradesphere-super-secret-key';

export interface UserPayload {
  id: number;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      reply.status(401).send({ error: 'Authentication token is missing' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    request.user = decoded;
  } catch (error) {
    reply.status(401).send({ error: 'Invalid or expired authentication token' });
  }
}

export function authorizeRoles(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Make sure user is authenticated first
    if (!request.user) {
      reply.status(401).send({ error: 'Unauthenticated request' });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden: Insufficient role permissions' });
      return;
    }
  };
}
