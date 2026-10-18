import { domMax } from "motion/react";

// Loaded after first paint: layout animations, shared elements and drag
// (M01, M12, M16, M18, M19) need domMax, not domAnimation.
export default domMax;
