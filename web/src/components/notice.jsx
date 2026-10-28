import { useEffect, useState } from 'react';
import { Alert } from './ui/alert.jsx';

const SUCCESS_TIMEOUT_MS = 5000;

export function ErrorAlert({ error }) {
  if (!error) return null;
  return <Alert role="alert" variant="destructive">{error.message}</Alert>;
}

export function SuccessAlert({ message }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return undefined;
    const timer = setTimeout(() => setVisible(false), SUCCESS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message || !visible) return null;
  return <Alert variant="success" className="mb-6">{message}</Alert>;
}
