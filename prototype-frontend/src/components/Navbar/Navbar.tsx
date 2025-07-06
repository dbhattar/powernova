import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Settings, User } from "lucide-react";

export function Navbar() {
  return (
    <header className="border-b w-full">
      <div className="flex h-16 items-center px-4">
        <Button variant="ghost" size="icon">
          <span className="sr-only">Toggle menu</span>
        </Button>
        <Link to={"/"} className="ml-4 flex items-center space-x-4">
          <img
            src="src/assets/CosmicGlobal.svg"
            alt="Cosmic Global Logo"
            className="h-10"
          />
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
