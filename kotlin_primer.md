# Kotlin Primer — For Python/Java Developers

---

## 1. What Kotlin Actually Is (Under the Hood)

Kotlin compiles to **JVM bytecode** — the exact same `.class` files Java produces.
At runtime, the JVM sees no difference between Kotlin and Java code. Your Samsung phone
runs an Android Runtime (ART) which AOT-compiles that bytecode to native ARM machine code
on install. So Kotlin has **identical memory and hardware characteristics to Java** — same
garbage collector, same heap, same thread model.

What Kotlin adds is a **smarter compiler** that catches more bugs at compile time,
and a **cleaner syntax** that removes Java's ceremony.

```
Your Kotlin source (.kt)
        ↓  kotlinc compiler
JVM bytecode (.class / .dex for Android)
        ↓  ART (on device, at install time)
Native ARM machine code
```

---

## 2. Variables — `val` vs `var`

In Python everything is mutable by default. In Java you use `final` to make something immutable.
Kotlin flips this — you declare intent upfront:

```kotlin
val name = "Appace"   // val = value = immutable (like Java's final, Python's concept of a constant)
var count = 0         // var = variable = mutable

count = 5             // ✅ fine
name = "Other"        // ❌ compile error — val cannot be reassigned
```

> **Rule of thumb:** Always use `val`. Only switch to `var` when you genuinely need mutation.
> The compiler will tell you if you're wrong.

**Memory note:** `val` doesn't mean the object is immutable — it means the *reference* can't change.
A `val list` can still have items added to it if the list itself is mutable. This is the same as
`final` in Java.

---

## 3. Type Inference

Kotlin is statically typed (like Java) but infers types (like Python looks):

```kotlin
val name = "Clancy"       // inferred as String
val age  = 21             // inferred as Int
val pi   = 3.14           // inferred as Double
```

You can also be explicit — same result:
```kotlin
val name: String = "Clancy"
val age: Int = 21
```

In our Appace code you'll see both styles. Explicit types on function signatures,
inferred types inside function bodies.

---

## 4. Null Safety — Kotlin's Biggest Departure from Java

In Java, any reference can be `null`. This causes `NullPointerException` — the most common
crash in Android apps. Kotlin bans `null` by default at the *type system* level.

```kotlin
var name: String  = "Clancy"   // cannot be null — compiler enforces this
var name: String? = null        // the ? means "nullable String" — null is allowed

name.length          // ❌ compile error on nullable type — might crash
name?.length         // ✅ safe call — returns null if name is null, Int if not
name!!.length        // ⚠️  force-unwrap — crashes if null (we never use !! in Appace)
name?.length ?: 0    // ✅ elvis operator — "length if not null, else 0"
```

The `?.` chain is the most common pattern you'll write:
```kotlin
val len = user?.profile?.name?.length ?: 0
// Each ?. short-circuits if null — returns 0 at the end if anything is null
// Python equivalent: len(user.profile.name) if user and user.profile and user.profile.name else 0
```

**Why this matters at the system level:** The JVM still allows null under the hood.
Kotlin's null safety is entirely a *compile-time* guarantee — the compiler rejects your code
if a null path exists without being handled. At runtime, the bytecode is the same.

---

## 5. Functions

```kotlin
// Basic function
fun greet(name: String): String {
    return "Hello, $name"
}

// Single-expression function (no braces, no return keyword)
fun greet(name: String): String = "Hello, $name"

// Default parameters (Java doesn't have these natively)
fun greet(name: String = "World"): String = "Hello, $name"
greet()           // "Hello, World"
greet("Clancy")   // "Hello, Clancy"

// Named arguments (call in any order)
fun createUser(name: String, age: Int, admin: Boolean = false) { ... }
createUser(age = 21, name = "Clancy")  // order doesn't matter when named
```

Python has all of these. Java doesn't — it uses overloads instead.

---

## 6. Classes

```kotlin
// Java would need ~30 lines for this. Kotlin: 1.
data class BalanceEntity(
    val id: Int = 1,
    val balanceSeconds: Long,
    val windowStartHour: Int
)
```

`data class` auto-generates:
- `equals()` / `hashCode()` — compares by field values, not reference
- `toString()` — prints field values, not a memory address
- `copy()` — creates a modified clone

```kotlin
val b = BalanceEntity(balanceSeconds = 300, windowStartHour = 6)
val b2 = b.copy(balanceSeconds = 600)  // new object, same windowStartHour
```

We use `copy()` everywhere in Appace's `tick()` function to update Room DB rows
without mutating the original.

**Memory note:** `copy()` creates a new object on the heap. The old one becomes
eligible for garbage collection. For small data classes like BalanceEntity this is
completely fine — the GC handles it efficiently.

---

## 7. `object` — Singletons Built Into the Language

Java singletons require a private constructor, a static field, and double-checked locking.
Kotlin has a keyword for it:

```kotlin
object Database {
    val connection = connect()
}

// First access creates the instance. Every subsequent access returns the same one.
Database.connection
```

We use this in `AppDatabase.getInstance()` — but actually use the companion object pattern:

```kotlin
class AppDatabase : RoomDatabase() {
    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null  // volatile = thread-safe visibility

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {        // synchronized = only one thread at a time
                INSTANCE ?: buildDatabase(context)  // double-check after acquiring lock
                    .also { INSTANCE = it }
            }
    }
}
```

`companion object` is Kotlin's equivalent of Java's `static` members — they belong to the
class, not instances.

---

## 8. Extension Functions — Adding Methods Without Subclassing

```kotlin
// Add a method to String without touching the String class
fun String.isPalindrome(): Boolean = this == this.reversed()

"racecar".isPalindrome()  // true
```

At the bytecode level, this compiles to a **static function** that takes the receiver as
its first argument — exactly like Python's explicit `self`:
```java
// What the JVM actually sees:
StringExtensionsKt.isPalindrome("racecar");
```

No overhead, no subclassing, no wrappers.

---

## 9. Lambdas and Higher-Order Functions

```kotlin
// A function that takes another function as a parameter
fun doTwice(action: () -> Unit) {
    action()
    action()
}

doTwice { println("hello") }  // trailing lambda syntax — braces after the call

// With parameters
val numbers = listOf(1, 2, 3, 4, 5)
val evens = numbers.filter { it % 2 == 0 }  // it = the implicit single parameter
val doubled = numbers.map { it * 2 }
```

Python equivalent: `filter(lambda x: x % 2 == 0, numbers)`

`it` is shorthand for the single parameter when there's only one. With multiple:
```kotlin
val pairs = listOf(1 to "one", 2 to "two")
pairs.forEach { (num, word) -> println("$num = $word") }
```

---

## 10. Coroutines — Kotlin's Concurrency Model

This is the **most important thing** to understand for Appace.

In Java/Android you use threads directly — painful, error-prone, verbose.
In Python you might have used `asyncio`.
Kotlin has **coroutines** — lightweight, structured concurrency.

### The Problem They Solve

Android's main thread handles all UI. If you do a database read on the main thread,
the UI freezes. Kotlin coroutines let you write async code that *looks* synchronous:

```kotlin
// WITHOUT coroutines (callback hell)
db.getBalance(callback = { balance ->
    runOnUiThread {
        updateUI(balance)
    }
})

// WITH coroutines
val balance = withContext(Dispatchers.IO) { db.getBalance() }
updateUI(balance)  // back on main thread automatically
```

### Dispatchers — Which Thread Pool?

```kotlin
Dispatchers.Main    // Android's UI thread — only for UI updates
Dispatchers.IO      // Thread pool for disk/network — use for Room DB, file I/O
Dispatchers.Default // Thread pool for CPU-heavy work — use for sorting, parsing
```

### In Appace

Every Room DB call is wrapped in `Dispatchers.IO`:
```kotlin
AsyncFunction("getBalance") { ->
    withContext(Dispatchers.IO) {
        repo.getBalance().balanceSeconds   // runs on IO thread pool, not main thread
    }
}
```

### Memory/System Note

Coroutines are **not threads**. A thread is an OS resource (~1MB stack each).
A coroutine is a Kotlin object on the heap — you can have 100,000 of them.
They're multiplexed onto a small thread pool. When a coroutine suspends (waiting for
IO), the thread is freed and can run another coroutine. No blocking.

```
Thread Pool (e.g. 4 threads for IO)
  Thread 1: running Coroutine A (DB read)
  Thread 2: running Coroutine B (DB write)
  Thread 3: idle — Coroutine C is suspended waiting for disk
  Thread 4: running Coroutine D
```

---

## 11. `when` — Switch on Steroids

```kotlin
val result = when (x) {
    0       -> "zero"
    1, 2    -> "one or two"
    in 3..9 -> "three to nine"
    is String -> "it's a string"
    else    -> "something else"
}
```

Python equivalent: `match/case` (3.10+). Java: `switch` (much more limited).

`when` can also be used without an argument (replaces if-else chains):
```kotlin
when {
    balance > 0 && isWithinWindow -> showBalance()
    !isWithinWindow               -> showWindowClosed()
    else                          -> showTimesUp()
}
```

---

## 12. Sealed Classes — Exhaustive State

```kotlin
sealed class AppState {
    object Loading : AppState()
    data class Success(val balance: Long) : AppState()
    data class Error(val message: String) : AppState()
}

// Compiler forces you to handle ALL cases — no runtime surprises
when (state) {
    is AppState.Loading       -> showSpinner()
    is AppState.Success       -> showBalance(state.balance)  // state is smart-cast here
    is AppState.Error         -> showError(state.message)
    // No else needed — sealed class means all subclasses are known at compile time
}
```

Python's closest equivalent is an Enum or Union type. Java doesn't have this natively
until Java 17's sealed classes.

---

## 13. Smart Casts

Kotlin tracks type checks and automatically casts — no explicit cast needed:

```kotlin
fun process(obj: Any) {
    if (obj is String) {
        println(obj.length)  // obj is automatically String here — no (String) cast
    }
}
```

This also works with null checks:
```kotlin
val name: String? = getName()
if (name != null) {
    println(name.length)  // name is automatically non-null String inside this block
}
```

---

## 14. String Templates

Python f-strings, but cleaner:

```kotlin
val name = "Clancy"
val balance = 300

println("Hello, $name")                    // simple variable
println("Balance: ${balance / 60} mins")   // expression in ${}
println("Type: ${name.javaClass.name}")    // method call in ${}
```

---

## 15. Key Differences from Java (Summary Table)

| Feature | Java | Kotlin |
|---|---|---|
| Null safety | Runtime NPE | Compile-time enforced |
| Singleton | Manual pattern | `object` keyword |
| Data classes | 30+ lines | `data class` — 1 line |
| Static members | `static` keyword | `companion object` |
| Default params | Overloads | `fun f(x: Int = 0)` |
| Extension methods | Utility classes | `fun Type.method()` |
| Concurrency | Threads/callbacks | Coroutines |
| Type casting | `(Type) obj` | Smart cast + `as` |
| Switch | `switch` (limited) | `when` (powerful) |
| Checked exceptions | Required | None — all unchecked |
| Semicolons | Required | Optional (never used) |

---

## 16. Things That Catch Java Developers Out

```kotlin
// == compares VALUE in Kotlin (not reference like Java)
"hello" == "hello"  // true — Kotlin uses equals() automatically
"hello" === "hello" // === is reference equality (rarely needed)

// Functions in Kotlin can be top-level — no class required
// File: Utils.kt
fun formatBalance(seconds: Long): String = "${seconds / 60}:${"%02d".format(seconds % 60)}"
// Call it from anywhere: formatBalance(300)

// Unit is Kotlin's void
fun doSomething(): Unit { }  // Unit = returns nothing meaningful
fun doSomething() { }        // Unit is implicit — same thing

// Nothing = a function that never returns (throws or infinite loops)
fun fail(msg: String): Nothing = throw IllegalStateException(msg)
```

---

## 17. What to Read in the Appace Codebase

Once we write it, look for these patterns and map them back here:

| Code Pattern | Section Above |
|---|---|
| `val`/`var` declarations | §2 |
| `?.` and `?: ` operators | §4 |
| `data class BalanceEntity` | §6 |
| `companion object { getInstance() }` | §7 |
| `withContext(Dispatchers.IO)` | §10 |
| `@Volatile`, `synchronized` | §7 |
| `copy(balanceSeconds = ...)` | §6 |
| `when (currentHour)` | §11 |
