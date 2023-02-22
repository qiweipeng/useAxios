import {useRef, useEffect} from 'react';

export default function useUpdateRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
