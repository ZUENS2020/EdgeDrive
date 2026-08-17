"use client";

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import IosShareIcon from "@mui/icons-material/IosShare";
import LabelIcon from "@mui/icons-material/Label";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PreviewIcon from "@mui/icons-material/Preview";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import IconButton from "@mui/material/IconButton";
import { type MouseEvent, type ReactNode } from "react";
import type { RowActionId } from "@/lib/row-actions";
import type { FileView } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export type FileRowActionEvent =
  | { type: RowActionId }
  | { type: "more"; event: MouseEvent<HTMLElement> }
  | { type: "restore" }
  | { type: "purge" };

type Props = {
  file: FileView;
  actions: readonly RowActionId[];
  trash?: boolean;
  onAction: (file: FileView, event: FileRowActionEvent) => void;
};

function ActionBtn({
  title,
  color,
  href,
  onClick,
  children,
}: {
  title: string;
  color?: "inherit" | "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const stop = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onClick?.(e);
  };
  if (href) {
    return (
      <IconButton
        size="small"
        title={title}
        aria-label={title}
        color={color}
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={stop}
      >
        {children}
      </IconButton>
    );
  }
  return (
    <IconButton size="small" title={title} aria-label={title} color={color} onClick={stop}>
      {children}
    </IconButton>
  );
}

export function FileRowActions({ file, actions, trash, onAction }: Props) {
  const { t } = useI18n();
  function actionButton(id: RowActionId) {
    switch (id) {
      case "download":
        return (
          <ActionBtn key={id} title={t("rowAction.download")} href={file.contentUrl}>
            <DownloadIcon fontSize="small" />
          </ActionBtn>
        );
      case "preview":
        return (
          <ActionBtn key={id} title={t("rowAction.preview")} href={file.adminViewUrl}>
            <PreviewIcon fontSize="small" />
          </ActionBtn>
        );
      case "share":
        return (
          <ActionBtn key={id} title={t("fileManager.newShare")} onClick={() => onAction(file, { type: "share" })}>
            <IosShareIcon fontSize="small" />
          </ActionBtn>
        );
      case "expire":
        return (
          <ActionBtn key={id} title={t("rowAction.expire")} onClick={() => onAction(file, { type: "expire" })}>
            <ScheduleIcon fontSize="small" />
          </ActionBtn>
        );
      case "star":
        return (
          <ActionBtn
            key={id}
            title={file.starred ? t("rowAction.unstar") : t("rowAction.starOn")}
            color={file.starred ? "warning" : "default"}
            onClick={() => onAction(file, { type: "star" })}
          >
            {file.starred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
          </ActionBtn>
        );
      case "tags":
        return (
          <ActionBtn key={id} title={t("rowAction.tags")} onClick={() => onAction(file, { type: "tags" })}>
            <LabelIcon fontSize="small" />
          </ActionBtn>
        );
      case "copy_to":
        return (
          <ActionBtn key={id} title={t("rowAction.copy_to")} onClick={() => onAction(file, { type: "copy_to" })}>
            <FileCopyIcon fontSize="small" />
          </ActionBtn>
        );
      case "delete":
        return (
          <ActionBtn key={id} title={t("rowAction.delete")} color="error" onClick={() => onAction(file, { type: "delete" })}>
            <DeleteOutlineIcon fontSize="small" />
          </ActionBtn>
        );
    }
  }

  return (
    <>
      {trash ? (
        <>
          <ActionBtn title={t("rowAction.restore")} onClick={() => onAction(file, { type: "restore" })}>
            <RestoreFromTrashIcon fontSize="small" />
          </ActionBtn>
          <ActionBtn title={t("rowAction.purge")} color="error" onClick={() => onAction(file, { type: "purge" })}>
            <DeleteForeverIcon fontSize="small" />
          </ActionBtn>
        </>
      ) : (
        actions.map((id) => actionButton(id))
      )}
      <ActionBtn title={t("common.more")} onClick={(e) => onAction(file, { type: "more", event: e })}>
        <MoreVertIcon fontSize="small" />
      </ActionBtn>
    </>
  );
}
