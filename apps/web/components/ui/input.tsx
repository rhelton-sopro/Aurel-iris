import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// ⚠️ `text-base md:text-sm`: 16px no celular, 14px no desktop.
//
// O 14px cru fazia o iOS Safari dar aquele salto de zoom ao focar o campo — foi
// por isso que o app inteiro tinha a pinça desligada (`userScalable: false`), o
// que também impedia o terapeuta de aumentar o relatório e o cliente de enxergar
// a tela da captura. A pinça voltou; o salto se resolve aqui, no tamanho do
// campo, que é onde o problema sempre esteve. O textarea já fazia assim.

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-base md:text-sm transition-colors duration-[180ms] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-mist focus-visible:border-b-teal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
