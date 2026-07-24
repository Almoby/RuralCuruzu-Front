import { UserRole } from '../../shared/enums';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  memberCode?: string;
  merchantId?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  memberCode?: string;
  merchantId?: string;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}
