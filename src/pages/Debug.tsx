import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store/useStore';

export default function Debug() {
  const { siteSettings } = useStore();
  const [firestoreData, setFirestoreData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      setFirestoreData(snap.data());
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Debug Settings</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-yellow-400">Store State (siteSettings)</h2>
        <pre className="bg-gray-800 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(siteSettings, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-green-400">Firestore Data (settings/global)</h2>
        <pre className="bg-gray-800 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(firestoreData, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-blue-400">Video URLs</h2>
        <div className="bg-gray-800 p-4 rounded">
          <p className="mb-2"><strong>Hero Video (Store):</strong> {siteSettings?.heroVideoUrl || 'Not set'}</p>
          <p className="mb-2"><strong>Hero Video (Firestore):</strong> {firestoreData?.heroVideoUrl || 'Not set'}</p>
          <p className="mb-2"><strong>Hero BG (Store):</strong> {siteSettings?.heroBgUrl || 'Not set'}</p>
          <p className="mb-2"><strong>Hero BG (Firestore):</strong> {firestoreData?.heroBgUrl || 'Not set'}</p>
        </div>
      </div>

      {siteSettings?.heroVideoUrl && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-purple-400">Video Test</h2>
          <video 
            src={siteSettings.heroVideoUrl} 
            controls 
            className="w-full max-w-2xl"
          />
        </div>
      )}
    </div>
  );
}
