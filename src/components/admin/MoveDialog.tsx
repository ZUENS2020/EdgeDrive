"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useEffect, useState } from "react";

export function MoveDialog({
  open,
  count,
  folders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  folders: { path: string; label: string }[];
  onClose: () => void;
  onSubmit: (path: string) => void;
}) {
  const [path, setPath] = useState("");
  useEffect(() => {
    if (open) setPath("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>移动到文件夹{count > 1 ? `（${count} 个）` : ""}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>目标</InputLabel>
          <Select label="目标" value={path || "__root__"} onChange={(e) => setPath(e.target.value === "__root__" ? "" : e.target.value)}>
            <MenuItem value="__root__">根目录</MenuItem>
            {folders.map((f) => (
              <MenuItem key={f.path} value={f.path}>
                {f.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={() => onSubmit(path)}>
          移动
        </Button>
      </DialogActions>
    </Dialog>
  );
}
