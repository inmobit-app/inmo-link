import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";

interface Props {
  ids: string[];
  onClear: () => void;
}

export default function CompareBar({ ids, onClear }: Props) {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full px-6 py-3 shadow-lg flex items-center gap-3">
      <span className="font-medium text-sm">Comparar ({ids.length})</span>
      <Button
        size="sm"
        variant="secondary"
        className="gap-1"
        onClick={() => navigate(`/comparar?ids=${ids.join(",")}`)}
      >
        Ver comparación <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      <button onClick={onClear} className="hover:bg-primary-foreground/20 rounded-full p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
