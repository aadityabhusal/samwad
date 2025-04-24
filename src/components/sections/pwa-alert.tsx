import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useRegisterSW } from "virtual:pwa-register/react";

function PWAAlert() {
  // check for updates every hour
  const period = 60 * 60 * 1000;

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (period <= 0) return;
      if (r?.active?.state === "activated") {
        registerPeriodicSync(period, swUrl, r);
      } else if (r?.installing) {
        r.installing.addEventListener("statechange", (e) => {
          const sw = e.target as ServiceWorker;
          if (sw.state === "activated") registerPeriodicSync(period, swUrl, r);
        });
      }
    },
  });

  return (
    <AlertDialog open={needRefresh}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>New updates available</AlertDialogTitle>
          <AlertDialogDescription>
            Click on the button below to update your app to the latest version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="justify-center gap-4">
          <AlertDialogCancel onClick={() => setNeedRefresh(false)}>
            Close
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => updateServiceWorker(true)}>
            Update now!
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PWAAlert;

/**
 * This function will register a periodic sync check every hour, you can modify the interval as needed.
 */
function registerPeriodicSync(
  period: number,
  swUrl: string,
  r: ServiceWorkerRegistration
) {
  if (period <= 0) return;

  setInterval(async () => {
    if ("onLine" in navigator && !navigator.onLine) return;

    const resp = await fetch(swUrl, {
      cache: "no-store",
      headers: {
        cache: "no-store",
        "cache-control": "no-cache",
      },
    });

    if (resp?.status === 200) await r.update();
  }, period);
}
