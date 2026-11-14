// Ruta de desarrollo: no hereda el shell de la app (header + bottom nav) para
// que el laboratorio ocupe la pantalla completa. Se elimina del build de
// producción con el guard de la página.
export default function DevEdgeCasesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
