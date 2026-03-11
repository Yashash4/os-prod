import { redirect } from "next/navigation";

export default function TasksRoot() {
  redirect("/m/tasks/board");
}
