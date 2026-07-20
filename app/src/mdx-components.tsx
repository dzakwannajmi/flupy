import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

function TypesetWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="typeset typeset-docs">
      {children}
    </div>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    wrapper: TypesetWrapper,
  };
}
