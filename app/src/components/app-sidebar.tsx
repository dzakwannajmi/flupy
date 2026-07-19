"use client"

import * as React from "react"
import { Icon } from "@iconify/react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Overview",
      url: "/docs",
      icon: <Icon icon="ph:rocket-launch" width={18} height={18} />,
    },
  ],
  navSdk: [
    {
      title: "Installation",
      url: "/docs/installation",
      icon: <Icon icon="ph:download-simple" width={18} height={18} />,
    },
    {
      title: "Quickstart",
      url: "/docs/quickstart",
      icon: <Icon icon="ph:flag" width={18} height={18} />,
    },
    {
      title: "@flupy/core",
      url: "/docs/core",
      icon: <Icon icon="ph:cube" width={18} height={18} />,
    },
    {
      title: "@flupy/browser",
      url: "/docs/browser",
      icon: <Icon icon="ph:globe" width={18} height={18} />,
    },
    {
      title: "@flupy/react",
      url: "/docs/react",
      icon: <Icon icon="ph:atom" width={18} height={18} />,
    },
  ],
  navGuides: [
    {
      title: "Examples",
      url: "/docs/examples",
      icon: <Icon icon="ph:code" width={18} height={18} />,
    },
    {
      title: "Security Model",
      url: "/docs/security",
      icon: <Icon icon="ph:shield-check" width={18} height={18} />,
    },
    {
      title: "Fee Model",
      url: "/docs/fee-model",
      icon: <Icon icon="ph:coins" width={18} height={18} />,
    },
    {
      title: "Troubleshooting",
      url: "/docs/troubleshooting",
      icon: <Icon icon="ph:wrench" width={18} height={18} />,
    },
  ],
  navSecondary: [
    {
      title: "GitHub",
      url: "https://github.com/dzakwannajmi/flupy",
      icon: <Icon icon="ph:github-logo" width={18} height={18} />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/" />}
            >
              <Icon icon="ph:sparkle-fill" width={20} height={20} className="text-[#163300]" />
              <span className="text-base font-semibold">Flupy Docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} label="Overview" />
        <NavMain items={data.navSdk} label="SDK Reference" />
        <NavMain items={data.navGuides} label="Guides" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
    </Sidebar>
  )
}
