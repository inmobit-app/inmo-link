import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import type { PropertyFormData } from "../PropertyWizard";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ImagePlus, Star, X, GripVertical } from "lucide-react";

interface Props {
  form: PropertyFormData;
  update: (p: Partial<PropertyFormData>) => void;
}

export default function StepPhotosDescription({ form, update }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      update({ photos: [...form.photos, ...accepted] });
    },
    [form.photos, update]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: true,
  });

  const removePhoto = (i: number) => {
    const next = form.photos.filter((_, idx) => idx !== i);
    update({
      photos: next,
      coverIndex: form.coverIndex === i ? 0 : form.coverIndex > i ? form.coverIndex - 1 : form.coverIndex,
    });
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= form.photos.length) return;
    const arr = [...form.photos];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    let newCover = form.coverIndex;
    if (form.coverIndex === from) newCover = to;
    else if (from < form.coverIndex && to >= form.coverIndex) newCover--;
    else if (from > form.coverIndex && to <= form.coverIndex) newCover++;
    update({ photos: arr, coverIndex: newCover });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold mb-3 block">Fotos</Label>
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Arrastrá fotos acá o hacé click para seleccionar
          </p>
        </div>
      </div>

      {form.photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {form.photos.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className={cn(
                "relative group rounded-lg overflow-hidden border-2 transition-all",
                i === form.coverIndex ? "border-primary ring-2 ring-primary/30" : "border-border"
              )}
            >
              <img
                src={URL.createObjectURL(file)}
                alt={`Foto ${i + 1}`}
                className="w-full h-28 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => update({ coverIndex: i })}
                  className="p-1.5 rounded-full bg-background/90 text-foreground hover:bg-primary hover:text-primary-foreground"
                  title="Marcar como portada"
                >
                  <Star className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(i, i - 1)}
                  className="p-1.5 rounded-full bg-background/90 text-foreground hover:bg-accent"
                  title="Mover izq"
                  disabled={i === 0}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="p-1.5 rounded-full bg-background/90 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  title="Eliminar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {i === form.coverIndex && (
                <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                  Portada
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <Label className="mb-1 block">Descripción</Label>
        <Textarea
          rows={5}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Describí las características de la propiedad, su entorno, ventajas..."
        />
      </div>
    </div>
  );
}
