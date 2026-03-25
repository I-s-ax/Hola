// Tipos para el proyecto
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_EXPIRATION_DAYS: string;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  password_hash: string;
  is_verified: number;
  verification_code: string | null;
  code_expiration: string | null;
  reset_code: string | null;
  reset_code_expiration: string | null;
  created_at: string;
}

export interface UserResponse {
  user_id: string;
  email: string;
  name: string;
  is_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface MessageResponse {
  message: string;
  success: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface VerifyInput {
  email: string;
  code: string;
}

export interface ResetPasswordInput {
  email: string;
  code: string;
  new_password: string;
}

// Cards
export interface Card {
  card_id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_data: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
