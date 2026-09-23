import { redirect } from "next/navigation";

export default function JoinPage() {
  redirect("/auth?mode=signup&type=contractor");
}
