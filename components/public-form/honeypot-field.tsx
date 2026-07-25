/**
 * Campo isca antispam — posicionado fora da tela (não `display:none`, que bots
 * mais sofisticados já ignoram) e fora da ordem de tab. Qualquer preenchimento
 * aqui derruba o envio como spam; validação real de bot entra no Milestone 15.
 */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="absolute top-auto -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor="website">Deixe este campo em branco</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
