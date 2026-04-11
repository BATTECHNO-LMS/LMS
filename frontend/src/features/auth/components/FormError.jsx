export function FormError({ message, id }) {
  if (!message) return null;
  return (
    <p id={id} className="form-field__error form-error" role="alert">
      {message}
    </p>
  );
}
