import type { Metadata } from "next";
import { ChildBrandSignupPage } from "../../../components/ChildBrandSignupPage";

export const metadata: Metadata = {
  title: "Start NoticeGrid",
  description: "Request early access to NoticeGrid.",
};

export default function Page() {
  return <ChildBrandSignupPage brandKey="noticegrid" />;
}
