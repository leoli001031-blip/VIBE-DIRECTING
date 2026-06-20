type DirectorModeComponent = typeof import("./DirectorModeShell").DirectorMode;

import { DirectorMode as ImportedDirectorMode } from "./DirectorModeShell";

export const DirectorMode = ImportedDirectorMode as DirectorModeComponent;
