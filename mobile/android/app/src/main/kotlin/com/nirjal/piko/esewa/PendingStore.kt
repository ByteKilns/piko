package com.nirjal.piko.esewa

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable queue of raw events. Every captured notification goes in here first,
 * whether or not the app is running, and stays until Dart acks it after
 * storing it on the server. So a payment made while the phone is offline, or
 * while Piko is closed, is never lost.
 * Capped so a long-closed app can't grow it without limit.
 */
object PendingStore {
    private const val PREFS = "esewa_pending"
    private const val KEY = "events"
    private const val MAX = 500

    /**
     * Names one notification. Android re-posts an updated notification under
     * the same key, and an app may reuse one key for every notification, so
     * the post time is part of the name.
     */
    private fun idOf(event: JSONObject) = "${event.optString("key")}@${event.optLong("postedAt")}"

    @Synchronized
    fun append(ctx: Context, event: JSONObject) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        val id = idOf(event)
        for (i in 0 until arr.length()) {
            if (arr.getJSONObject(i).optString("id") == id) return
        }
        arr.put(event.put("id", id))
        val trimmed = if (arr.length() > MAX) {
            JSONArray().also { out -> for (i in arr.length() - MAX until arr.length()) out.put(arr.get(i)) }
        } else arr
        // commit, not apply: the process may be killed right after a notification.
        prefs.edit().putString(KEY, trimmed.toString()).commit()
    }

    /** Every queued event, oldest first. Nothing is removed until [ack]. */
    @Synchronized
    fun pending(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"

    /** Removes the events Dart has stored. */
    @Synchronized
    fun ack(ctx: Context, ids: Collection<String>) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        val kept = JSONArray()
        for (i in 0 until arr.length()) {
            val event = arr.getJSONObject(i)
            if (event.optString("id") !in ids) kept.put(event)
        }
        prefs.edit().putString(KEY, kept.toString()).commit()
    }
}
