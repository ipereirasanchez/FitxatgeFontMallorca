# Fichaje

Web de fichaje de personal (entrada/salida) pensada para funcionar como **kiosko**:
un único dispositivo (tablet u ordenador) en la entrada, donde cada persona
ficha pulsando su nombre.

## Cómo funciona

- **Pantalla principal**: lista de personal. Cada persona pulsa su nombre.
- **Ficha individual**: botón "Iniciar jornada" / "Finalizar jornada" según si
  ya está fichado, y un histórico de sus últimos días.
- **Administración** (botón arriba a la derecha, protegido con contraseña):
  - Consulta de fichajes por persona y rango de fechas (entrada, salida y
    horas totales por día), con exportación a CSV.
  - Añadir o eliminar personal de la lista (el histórico de una persona
    eliminada se conserva).
  - Cambiar la contraseña de administrador.

**Contraseña de administrador por defecto: `admin1234`.** Cámbiala en cuanto
despliegues la web (Administración → Cambiar contraseña).

## Dónde se guardan los datos

Todo se guarda en el `localStorage` del navegador del dispositivo donde se
usa la web. No hay servidor ni base de datos: por eso es importante que
**todo el personal fiche siempre desde el mismo dispositivo/navegador**.
Si se borran los datos de navegación de ese navegador, o se ficha desde otro
dispositivo, se pierde el histórico correspondiente.

Esto también significa que los datos personales (nombres y horarios) nunca
salen de ese dispositivo ni pasan por ningún servidor externo.

**Importante sobre la contraseña de administrador**: al estar alojada en
GitHub Pages (sitio estático, sin backend), esta contraseña es una barrera
para evitar que cualquiera consulte los fichajes desde el propio kiosko, pero
no es seguridad real frente a alguien con acceso al código fuente del sitio o
a las herramientas de desarrollador del navegador. No la reutilices con otras
cuentas y no la consideres una protección de datos sensible.

## Desplegar en GitHub Pages

1. Crea un repositorio en GitHub y sube estos archivos (`index.html`,
   `style.css`, `app.js`).
2. En el repositorio: **Settings → Pages**.
3. En "Source", selecciona la rama (p. ej. `main`) y la carpeta `/ (root)`.
4. Guarda. GitHub te dará una URL del tipo
   `https://<usuario>.github.io/<repositorio>/`.
5. Abre esa URL desde el dispositivo que hará de kiosko y, la primera vez,
   entra en Administración para añadir al personal y cambiar la contraseña.

## Probar en local

Basta con abrir `index.html` en el navegador. Si tu navegador bloquea
`crypto.subtle` al abrir el archivo directamente (`file://`), sirve la
carpeta con un servidor local, por ejemplo:

```bash
python3 -m http.server 8000
```

y visita `http://localhost:8000`.
