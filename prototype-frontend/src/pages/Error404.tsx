import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function Error404() {
  return (
    <div className="">
      <img
        src="/CosmicGlobal.svg"
        alt="Cosmic Global Logo"
        className="h-10 m-10"
      />
      <div className="flex flex-col items-center justify-center mt-32 sm:mt-64">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-foreground mb-6">
            Page Not Found
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Oops! The page you're looking for doesn't exist.
          </p>
          <Link to="/">
            <Button className="px-6 py-3 text-lg">Return Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
