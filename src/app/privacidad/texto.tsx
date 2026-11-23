/** Aviso de privacidad (texto base: conviene que lo revise un abogado antes de vender la app). */
export function TextoPrivacidad({ club }: { club?: string }) {
  const quien = club ?? "tu club";
  return (
    <div className="legal">
      <h2>Quién trata tus datos</h2>
      <p><b>{quien}</b> es el responsable de tus datos: decide para qué se usan. PalaClass es la herramienta que el club usa
        para organizar sus clases y trata los datos solo por encargo del club y siguiendo sus instrucciones.</p>
      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Nombre, email, nivel y grupos.</li>
        <li>Asistencia, bajas avisadas y recuperaciones.</li>
        <li>Mensajes del chat de tu grupo y avisos de la app.</li>
        <li>Si eres alumno, la ficha que escribe tu profesor: qué has trabajado, qué te toca trabajar y, si se lo cuentas,
          lesiones o molestias. Esto último es un dato de salud y solo se anota con tu consentimiento expreso.</li>
      </ul>
      <h2>Para qué</h2>
      <p>Solo para organizar las clases del club: horarios, plazas, recuperaciones, seguimiento y comunicación con tu grupo.
        No se usan para publicidad, no se venden y no se ceden a nadie.</p>
      <h2>Base legal</h2>
      <p>La relación que tienes con el club para recibir las clases y tu consentimiento, que puedes retirar cuando quieras.</p>
      <h2>Dónde están</h2>
      <p>En servidores de la Unión Europea (base de datos en Irlanda). La web se sirve a través de Cloudflare y los emails
        de acceso se envían con Brevo (Francia), con las garantías que exige el RGPD.</p>
      <h2>Cuánto tiempo</h2>
      <p>Mientras seas alumno o profesor del club. Si te das de baja, el club puede guardar lo mínimo el tiempo que obligue la ley
        y después se borra. Puedes pedir que se borre todo antes.</p>
      <h2>Tus derechos</h2>
      <p>Puedes ver y descargar tus datos desde tu perfil («Descargar mis datos»), pedir que se corrijan o se borren,
        oponerte o limitar su uso. Para ello habla con {quien}. Si crees que no se respetan tus derechos, puedes reclamar
        ante la Agencia Española de Protección de Datos (aepd.es).</p>
      <h2>Menores</h2>
      <p>Si tienes menos de 14 años, tu madre, padre o tutor debe dar el consentimiento por ti.</p>
    </div>
  );
}
