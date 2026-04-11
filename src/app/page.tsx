import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';

/**
 * Root "/"  — server-side smart redirect.
 * Middleware has already verified the JWT and injected x-user-role.
 * If no token is present, middleware will have already redirected to /login
 * before this page even renders.
 */
export default function RootPage() {
  const token = cookies().get('falcon_access_token')?.value;

  if (!token) {
    redirect('/login');
  }

  // Middleware injects x-user-role for authenticated requests
  const role = headers().get('x-user-role');

  if (role === 'SUPER_ADMIN') {
    redirect('/super-admin/dashboard');
  }

  redirect('/admin/dashboard');
}
