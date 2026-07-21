import { Outlet, useLocation } from 'react-router-dom'

// Envuelve el contenido de cada layout y reproduce una animación de entrada
// cada vez que cambia la ruta, dando una transición suave entre módulos.
// Usar la ruta como `key` fuerza el remontaje y reinicia la animación.
export default function PageTransition() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-transition h-full">
      <Outlet />
    </div>
  )
}
