import Brand from '../components/Brand';

export default function SetupRequired() {
  return <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-50 to-white p-4">
    <div className="card w-full max-w-2xl space-y-4">
      <Brand />
      <h2 className="text-2xl font-black">Firebase setup required</h2>
      <p className="text-slate-600">To use SGMI-KK LENDMART you need to connect a Firebase project. The app expects environment variables for Auth and Firestore, including on Netlify during build.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Go to <a className="font-bold text-primary-700" target="_blank" rel="noreferrer" href="https://console.firebase.google.com">Firebase Console</a> and create a project.</li>
        <li>Enable <b>Authentication</b> with the <b>Email/Password</b> provider.</li>
        <li>Create a <b>Firestore Database</b>.</li>
        <li>Register a Web App and copy the config values.</li>
        <li>Create a <code className="rounded bg-slate-100 px-1">.env</code> file locally or add the same values in <b>Netlify Site settings → Build & deploy → Environment variables</b> with the <code className="rounded bg-slate-100 px-1">VITE_</code> prefix.</li>
        <li>Required keys are:</li>
      </ol>
      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{`VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000
VITE_FIREBASE_APP_ID=1:000:web:xxxx`}</pre>
      <p className="text-sm text-slate-600">After saving the file, restart <code className="rounded bg-slate-100 px-1">npm run dev</code> and refresh this page.</p>
    </div>
  </div>;
}
