import { Alert } from './ui/alert.jsx';

export function ErrorAlert({ error }) {
  if (!error) return null;
  return <Alert role="alert" variant="destructive">{error.message}</Alert>;
}

export function SuccessAlert({ message }) {
  if (!message) return null;
  return <Alert variant="success" className="mb-6">{message}</Alert>;
}
