import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { z } from "zod";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function authorizeDevHardcodedUser(email: string, password: string) {
  if (
    env.NODE_ENV !== "development" ||
    !env.DEV_HARDCODE_USER_EMAIL ||
    !env.DEV_HARDCODE_USER_PASSWORD
  ) {
    return null;
  }

  const normalizedDevEmail = env.DEV_HARDCODE_USER_EMAIL.toLowerCase().trim();
  const normalizedIncomingEmail = email.toLowerCase().trim();

  if (
    normalizedIncomingEmail !== normalizedDevEmail ||
    password !== env.DEV_HARDCODE_USER_PASSWORD
  ) {
    return null;
  }

  return {
    id: "dev-hardcoded-user",
    email: normalizedDevEmail,
    name: env.DEV_HARDCODE_USER_NAME ?? "Dev User",
    image: null,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email e senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const rawEmail =
          typeof credentials?.email === "string" ? credentials.email : "";
        const rawPassword =
          typeof credentials?.password === "string" ? credentials.password : "";

        const devUser = await authorizeDevHardcodedUser(rawEmail, rawPassword);
        if (devUser) {
          return devUser;
        }

        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
};
