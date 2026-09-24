'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Contraseñas estáticas (puedes agregar o quitar las que quieras)
const VALID_PASSWORDS = [
  'abunda2026',
  'abunda2027',
  'abunda1'
];

export async function loginAction(prevState: any, formData: FormData) {
  const password = formData.get('password') as string;
  
  if (VALID_PASSWORDS.includes(password)) {
    const cookieStore = await cookies();
    cookieStore.set('scrapeflow_auth', password, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: '/'
    });
    
    // Redirigir al dashboard
    redirect('/');
  }
  
  return { error: 'Contraseña incorrecta' };
}
