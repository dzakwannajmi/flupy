import type { ReactNode } from "react";
import { FluppyAppProvider } from "./providers";

export default function AppRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FluppyAppProvider>
      {children}
    </FluppyAppProvider>
  );
}
