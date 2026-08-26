"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  location: string;
  description: string;
  image_url: string | null;
  created_at: string;
};

export default function MyProjects() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [projects, setProjects] = useState<Project[]>([]);
  const [editProject, setEditProject] =
    useState<Project | null>(null);
  const [editImageFile, setEditImageFile] =
    useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.replace("/auth");
      return;
    }

    const { data, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (projectsError) {
      setError(projectsError.message);
      setProjects([]);
    } else {
      setProjects(data ?? []);
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function getImagePath(imageUrl: string | null) {
    if (!imageUrl) return null;

    const marker =
      "/storage/v1/object/public/project-images/";

    const path = imageUrl.split(marker)[1];

    if (!path) return null;

    return decodeURIComponent(path.split("?")[0]);
  }

  function openEdit(project: Project) {
    setEditProject({ ...project });
    setEditImageFile(null);
  }

  function closeEdit() {
    setEditProject(null);
    setEditImageFile(null);
  }

  async function handleDelete(project: Project) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) return;

    const imagePath = getImagePath(project.image_url);

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    if (imagePath) {
      const { error: imageDeleteError } =
        await supabase.storage
          .from("project-images")
          .remove([imagePath]);

      if (imageDeleteError) {
        console.error(
          "Image deletion failed:",
          imageDeleteError.message
        );

        alert(
          "Project deleted, but its image could not be removed."
        );
      }
    }

    setProjects((currentProjects) =>
      currentProjects.filter(
        (currentProject) =>
          currentProject.id !== project.id
      )
    );
  }

  async function handleSaveEdit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!editProject) return;

    if (
      !editProject.name.trim() ||
      !editProject.type ||
      !editProject.location.trim() ||
      !editProject.description.trim()
    ) {
      alert("Please complete all project details.");
      return;
    }

    if (editImageFile) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(editImageFile.type)) {
        alert("Please select a JPG, PNG or WebP image.");
        return;
      }

      if (editImageFile.size > 5 * 1024 * 1024) {
        alert("The image must be smaller than 5 MB.");
        return;
      }
    }

    setSaving(true);

    let newImagePath: string | null = null;
    let newImageUrl = editProject.image_url;

    const oldImagePath = getImagePath(
      editProject.image_url
    );

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again.");
      }

      if (editImageFile) {
        const extension =
          editImageFile.type === "image/png"
            ? "png"
            : editImageFile.type === "image/webp"
              ? "webp"
              : "jpg";

        newImagePath =
          `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } =
          await supabase.storage
            .from("project-images")
            .upload(newImagePath, editImageFile, {
              contentType: editImageFile.type,
              cacheControl: "3600",
              upsert: false,
            });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } =
          supabase.storage
            .from("project-images")
            .getPublicUrl(newImagePath);

        newImageUrl = publicUrlData.publicUrl;
      }

      const { data, error: updateError } =
        await supabase
          .from("projects")
          .update({
            name: editProject.name.trim(),
            type: editProject.type,
            location: editProject.location.trim(),
            description:
              editProject.description.trim(),
            image_url: newImageUrl,
          })
          .eq("id", editProject.id)
          .select()
          .single();

      if (updateError) {
        if (newImagePath) {
          await supabase.storage
            .from("project-images")
            .remove([newImagePath]);
        }

        throw new Error(updateError.message);
      }

      if (
        editImageFile &&
        oldImagePath &&
        oldImagePath !== newImagePath
      ) {
        const { error: oldImageDeleteError } =
          await supabase.storage
            .from("project-images")
            .remove([oldImagePath]);

        if (oldImageDeleteError) {
          console.error(
            "Old image deletion failed:",
            oldImageDeleteError.message
          );
        }
      }

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === data.id ? data : project
        )
      );

      closeEdit();
    } catch (updateError) {
      alert(
        updateError instanceof Error
          ? updateError.message
          : "Could not update the project."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    const { error: logoutError } =
      await supabase.auth.signOut({
        scope: "local",
      });

    if (logoutError) {
      alert(logoutError.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/auth");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              My Projects
            </h1>

            <p className="text-gray-600">
              Manage and showcase your completed construction
              projects.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/profile"
              className="bg-blue-600 text-white px-5 py-3 rounded-lg text-center hover:bg-blue-700"
            >
              My Profile
            </Link>
<Link
  href="/requests"
  className="bg-blue-600 text-white px-5 py-3 rounded-lg text-center hover:bg-blue-700"
>
  My Requests
</Link>
            <Link
              href="/projects"
              className="bg-black text-white px-5 py-3 rounded-lg text-center hover:bg-gray-800"
            >
              + Add New Project
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-gray-200 px-5 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              {loggingOut
                ? "Logging out..."
                : "Log Out"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
            ❌ {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow p-8">
            <p className="text-gray-600">
              Loading projects...
            </p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8">
            <p className="text-gray-600">
              No projects added yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-xl shadow overflow-hidden"
              >
                {project.image_url ? (
                  <img
                    src={project.image_url}
                    alt={project.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    Project Photo
                  </div>
                )}

                <div className="p-5">
                  <h2 className="text-xl font-bold">
                    {project.name}
                  </h2>

                  <p className="text-gray-600 mt-2">
                    🏗️ {project.type}
                  </p>

                  <p className="text-gray-600">
                    📍 {project.location}
                  </p>

                  <p className="mt-3">
                    {project.description}
                  </p>

                  <div className="flex gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => openEdit(project)}
                      className="w-1/2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(project)
                      }
                      className="w-1/2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-5">
              Edit Project
            </h2>

            <form
              onSubmit={handleSaveEdit}
              className="space-y-4"
            >
              <input
                value={editProject.name}
                onChange={(e) =>
                  setEditProject({
                    ...editProject,
                    name: e.target.value,
                  })
                }
                placeholder="Project Name"
                required
                className="w-full border p-3 rounded-lg"
              />

              <select
                value={editProject.type}
                onChange={(e) =>
                  setEditProject({
                    ...editProject,
                    type: e.target.value,
                  })
                }
                required
                className="w-full border p-3 rounded-lg"
              >
                <option value="New Build">
                  New Build
                </option>

                <option value="Renovation">
                  Renovation
                </option>

                <option value="Extension">
                  Extension
                </option>
              </select>

              <input
                value={editProject.location}
                onChange={(e) =>
                  setEditProject({
                    ...editProject,
                    location: e.target.value,
                  })
                }
                placeholder="Location"
                required
                className="w-full border p-3 rounded-lg"
              />

              <textarea
                value={editProject.description}
                onChange={(e) =>
                  setEditProject({
                    ...editProject,
                    description: e.target.value,
                  })
                }
                placeholder="Description"
                required
                className="w-full border p-3 rounded-lg h-28"
              />

              {editProject.image_url && (
                <div>
                  <p className="font-medium mb-2">
                    Current Project Photo
                  </p>

                  <img
                    src={editProject.image_url}
                    alt="Current project"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium mb-2">
                  Change Project Photo
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setEditImageFile(
                      e.target.files?.[0] ?? null
                    )
                  }
                  className="w-full border p-3 rounded-lg"
                />

                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG or WebP. Maximum size: 5 MB.
                </p>

                {editImageFile && (
                  <p className="text-sm text-blue-600 mt-2">
                    New image selected:{" "}
                    {editImageFile.name}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="w-1/2 bg-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 bg-black text-white py-3 rounded-lg disabled:bg-gray-400"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}