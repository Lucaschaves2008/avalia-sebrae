export function SebraeLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
          <span className="text-lg font-black tracking-tighter text-primary">Se</span>
        </div>
        <div className="leading-tight">
          <div className="text-lg font-extrabold tracking-tight text-primary-foreground">
            SEBRAE
          </div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-secondary">
            Educação Empreendedora
          </div>
        </div>
      </div>
    </div>
  );
}
