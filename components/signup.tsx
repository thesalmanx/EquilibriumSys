'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Box } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords must match',
});

export function SignUp() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      // Store user session
      localStorage.setItem('userSession', JSON.stringify(data));
      toast({ title: 'Account created', description: 'Welcome, ' + data.name });
      router.push('/dashboard');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Signup Failed', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4 mx-auto">
      <div className="flex flex-col items-center space-y-2 text-center">
        <Box className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">EquilibriumSys</h1>
        <p className="text-muted-foreground">Create your account</p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>Enter your information below</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="John Doe" disabled={isLoading} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="email" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="john@example.com" disabled={isLoading} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="password" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••" disabled={isLoading} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="confirmPassword" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••" disabled={isLoading} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Creating...' : 'Create Account'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/" className="text-primary hover:underline">Sign in</Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
