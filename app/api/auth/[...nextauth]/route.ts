// app/api/auth/[...nextauth]/route.ts
export const runtime = 'nodejs';

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // NO checks: accept anyone as ADMIN
        return {
          id:    credentials?.email || 'anonymous',
          email: credentials?.email,
          name:  credentials?.email,
          role:  'ADMIN',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.email = user.email;
        token.name  = user.name;
        token.role  = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id    = token.id;
        session.user.email = token.email;
        session.user.name  = token.name;
        session.user.role  = token.role;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
