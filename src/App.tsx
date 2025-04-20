import { useState } from "react";
import PWABadge from "./PWABadge.tsx";
import { Button } from "./components/ui/button.tsx";

function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <h1>Samwad</h1>
      <div className="card">
        <Button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </Button>
      </div>
      <PWABadge />
    </>
  );
}

export default App;
