import { Link } from "react-router-dom";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "./SignInForm";

const DEMO_BOOK_LINK = "https://cosmicglobaltech.com/book-demo";

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500">
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute left-[calc(50%-4rem)] top-10 h-[42.375rem] w-[84.75rem] -translate-x-1/2 stroke-orange-300/70 [mask-image:radial-gradient(32rem_32rem_at_center,white,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84"
              width="200"
              height="200"
              x="50%"
              y="-1"
              patternUnits="userSpaceOnUse"
            >
              <path d="M.5 200V.5H200" fill="none" />
            </pattern>
          </defs>
          <svg x="50%" y="-1" className="overflow-visible fill-orange-200/20">
            <path
              d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
              strokeWidth="0"
            />
          </svg>
          <rect
            width="100%"
            height="100%"
            strokeWidth="0"
            fill="url(#1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84)"
          />
        </svg>
      </div>
      <Card className="w-full max-w-md bg-white backdrop-blur-sm shadow-orange-300 shadow-2xl p-4">
        <CardHeader className="space-y-4">
          <img
            src="/CosmicGlobal.svg"
            alt="Cosmic Global Logo"
            className="h-10 w-full"
          />
          <div>
            <CardTitle className="text-3xl font-bold text-center text-primary">
              Welcome Back
            </CardTitle>
            <p className="text-center text-primary/80">
              Sign in to your account
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignInForm />
          <div className="flex justify-center mt-4">
            <Link
              to={DEMO_BOOK_LINK}
              className="text-primary hover:text-primary/80 font-medium transition duration-300 ease-in-out underline"
            >
              Contact us to book a demo
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
