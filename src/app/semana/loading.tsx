// Se ve al instante mientras llegan los datos.
export default function Cargando() {
  return (
    <main className="app" aria-busy="true">
      <div className="cab">
        <div className="esq" style={{ height: 34, width: 180 }} />
        <div className="esq" style={{ height: 38 }} />
      </div>
      <div className="body">
        <div className="esq" style={{ height: 58 }} />
        <div className="esq" style={{ height: 140 }} />
        <div className="esq" style={{ height: 140 }} />
      </div>
    </main>
  );
}
