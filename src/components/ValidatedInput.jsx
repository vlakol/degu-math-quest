export function ValidatedInput({ label, register, name, error, ...rest }) {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      
      {/* ...register(name) "подключает" этот инпут к механизму React Hook Form.
        ...rest позволяет прокидывать любые стандартные HTML-атрибуты (placeholder, type и т.д.)
      */}
      <input 
        {...register(name)} 
        {...rest} 
        className={`math-input ${error ? 'input-error' : ''}`} 
      />
      
      {/* Если есть ошибка, рендерим её красным цветом */}
      {error && <span className="error-text">{error.message}</span>}
    </div>
  );
}