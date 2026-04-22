import { describe, test, expect } from "bun:test"
import { inferCategoryFromPrompt, resolveModelForCategory } from "./model-dispatch"

describe("model-dispatch", () => {
  describe("inferCategoryFromPrompt", () => {
    test("infers review category from 2+ keywords", () => {
      const result = inferCategoryFromPrompt("Review this code for security vulnerabilities and find bugs")
      expect(result).toBe("review")
    })

    test("infers research category from 2+ keywords", () => {
      const result = inferCategoryFromPrompt("Research the best practice approach and investigate alternatives")
      expect(result).toBe("research")
    })

    test("infers deep category from 2+ keywords", () => {
      const result = inferCategoryFromPrompt("Architecture design and complex system design plan")
      expect(result).toBe("deep")
    })

    test("infers quick category from 2+ keywords", () => {
      const result = inferCategoryFromPrompt("Quick simple fast minor fix")
      expect(result).toBe("quick")
    })

    test("infers visual-engineering category from 2+ keywords", () => {
      const result = inferCategoryFromPrompt("Build a UI component for the frontend design")
      expect(result).toBe("visual-engineering")
    })

    test("infers ultrabrain category from 2+ keywords", () => {
      const result = inferCategoryFromPrompt("Critical production incident root cause debug production")
      expect(result).toBe("ultrabrain")
    })

    test("returns undefined for single keyword (below threshold)", () => {
      const result = inferCategoryFromPrompt("Review this code")
      expect(result).toBeUndefined()
    })

    test("returns undefined for unmatched prompts", () => {
      expect(inferCategoryFromPrompt("Hello, how are you?")).toBeUndefined()
      expect(inferCategoryFromPrompt("List the files")).toBeUndefined()
    })
  })

  describe("resolveModelForCategory", () => {
    test("resolves review to kimi", () => {
      const result = resolveModelForCategory("review", undefined)
      expect(result).toEqual({ modelID: "kimi", providerID: "aether" })
    })

    test("resolves deep to glm-turbo", () => {
      const result = resolveModelForCategory("deep", undefined)
      expect(result).toEqual({ modelID: "glm-turbo", providerID: "aether" })
    })

    test("resolves quick to minimax", () => {
      const result = resolveModelForCategory("quick", undefined)
      expect(result).toEqual({ modelID: "minimax", providerID: "aether" })
    })

    test("falls back to parent model when no category", () => {
      const parent = { modelID: "glm-turbo", providerID: "aether" }
      const result = resolveModelForCategory(undefined, parent)
      expect(result).toEqual(parent)
    })

    test("falls back to default when no category and no parent", () => {
      const result = resolveModelForCategory(undefined, undefined)
      expect(result).toEqual({ modelID: "minimax", providerID: "aether" })
    })
  })
})
