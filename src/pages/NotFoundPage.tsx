import { Link } from "react-router-dom";
import { SearchX, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
      <SearchX className="mb-4 h-12 w-12 text-muted-foreground/40" />
      <h1 className="text-xl font-semibold">Sahifa topilmadi</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manzil noto'g'ri yoki o'chirilgan bo'lishi mumkin.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="outline" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </Link>
    </div>
  );
}
