"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Projects() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const form = e.currentTarget;

    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();

    const type = (
      form.elements.namedItem("type") as HTMLSelectElement
    ).value;

    const location = (
      form.elements.namedItem("location") as HTMLInputElement
    ).value.trim();

    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value.trim();

    const imageInput = form.elements.namedItem(
      "image"
    ) as HTMLInputElement;

    const imageFile = imageInput.files?.[0];

    if (
      !name ||
      !type ||
      !location ||
      !description ||
      !imageFile
    ) {
      setError(
        "Please complete all project details and select an image."
      );
      setSaved(false);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(imageFile.type)) {
      setError("Please select a JPG, PNG or WebP image.");
      return;
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      setError("The image must be smaller than 5 MB.");
      return;
    }

    setLoading(true);
    setError("");
    setSaved(false);

    let uploadedImagePath = "";

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Please log in before adding a project.");

        setTimeout(() => {
          router.push("/auth");
        }, 1000);

        return;
      }

      const extension =
        imageFile.type === "image/png"
          ? "png"
          : imageFile.type === "image/webp"
            ? "webp"
            : "jpg";

      uploadedImagePath =
        `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("project-images")
        .upload(uploadedImagePath, imageFile, {
          contentType: imageFile.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("project-images")
        .getPublicUrl(uploadedImagePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name,
          type,
          location,
          description,
          image_url: imageUrl,
        });

      if (insertError) {
        await supabase.storage
          .from("project-images")
          .remove([uploadedImagePath]);

        throw new Error(insertError.message);
      }

      setSaved(true);
      form.reset();

      setTimeout(() => {
        router.push("/my-projects");
        router.refresh();
      }, 800);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not save the project. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow p-8">
          <h1 className="text-3xl font-bold mb-2">
            Add New Project
          </h1>

          <p className="text-gray-600 mb-8">
            Add your completed projects to showcase your work.
          </p>

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
              ❌ {error}
            </div>
          )}

          {saved && (
            <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
              ✅ Project and image saved successfully!
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <input
              name="name"
              placeholder="Project Name"
              required
              className="w-full border p-3 rounded-lg"
            />

            <select
              name="type"
              defaultValue=""
              required
              className="w-full border p-3 rounded-lg"
            >
              <option value="" disabled>
                Select Type
              </option>

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
              name="location"
              placeholder="Location"
              required
              className="w-full border p-3 rounded-lg"
            />

            <textarea
              name="description"
              placeholder="Description"
              required
              className="w-full border p-3 rounded-lg h-32"
            />

            <div>
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="w-full border p-3 rounded-lg"
              />

              <p className="text-sm text-gray-500 mt-2">
                JPG, PNG or WebP. Maximum size: 5 MB.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
            >
              {loading
                ? "Uploading and saving..."
                : "Save Project"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}