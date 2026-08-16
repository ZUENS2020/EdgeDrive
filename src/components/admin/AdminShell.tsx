"use client";

import BarChartIcon from "@mui/icons-material/BarChart";
import FolderIcon from "@mui/icons-material/Folder";
import GitHubIcon from "@mui/icons-material/GitHub";
import IosShareIcon from "@mui/icons-material/IosShare";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { PRODUCT_NAME, PRODUCT_SHORT } from "@/lib/product";
import { useI18n } from "./I18nProvider";

const DRAWER = 260;

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: "/admin", label: t("nav.files"), icon: <FolderIcon />, exact: true },
    { href: "/admin/shares", label: t("nav.shares"), icon: <IosShareIcon /> },
    { href: "/admin/usage", label: t("nav.usage"), icon: <BarChartIcon /> },
    { href: "/admin/settings", label: t("nav.settings"), icon: <SettingsIcon /> },
  ];

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ gap: 1.5, px: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {PRODUCT_SHORT}
        </Box>
        <Box>
          <Typography fontWeight={700} lineHeight={1.2}>
            {PRODUCT_NAME}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Serverless
          </Typography>
        </Box>
      </Toolbar>
      <List sx={{ px: 1 }}>
        {nav.map((item) => {
          const on = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={on}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                color: "sidebarText",
                "&.Mui-selected": { color: "text.primary" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flex: 1, overflow: "auto", px: 1, pb: 2 }} id="admin-sider-extra" />
      <List sx={{ px: 1, mb: 1 }}>
        <ListItemButton
          component="a"
          href="https://github.com/ZUENS2020/EdgeDrive"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ borderRadius: 1, color: "sidebarText" }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
            <GitHubIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="GitHub" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="inherit" sx={{ display: { md: "none" } }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label={t("nav.openMenu")}>
            <MenuIcon />
          </IconButton>
          <Typography fontWeight={700}>{PRODUCT_NAME}</Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: DRAWER }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: DRAWER } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { width: DRAWER, boxSizing: "border-box" } }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          pt: { xs: 7, md: 0 },
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
