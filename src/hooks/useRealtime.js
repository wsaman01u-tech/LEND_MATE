import { useEffect, useState } from 'react';
import { subscribe } from '../lib/data';
import { useAuth } from '../state/AuthContext';

export default function useRealtime(coll, opts) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const optsStr = JSON.stringify(opts);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribe(coll, opts, (items) => {
      setData(items);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [coll, optsStr, uid]);

  return { data, loading };
}
