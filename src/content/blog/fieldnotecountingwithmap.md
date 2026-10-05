---
title: "One Counter Wasn't Enough: Per-Source Counts with std::map"
description: "Turning a streaming log counter into deterministic per-source state taught me why associative containers show up everywhere."
pubDate: "Oct 4 2026"
slug: "one-counter-wasnt-enough"
heroImage: "/imagesforarticles/clevelandmuseumofart.webp"
---

**FIELD NOTES: Short, Sharp, Summarized Learning Outcomes**

## Introduction

I've been working to deepen my C++ fluency by building things with real-world applications, rather than just building toy program after toy program.

For example, reviewing log files is a core part of what security analysts and threat hunters do when investigating hypotheses behind anomalous activity.

Once you understand the format used by a particular log source, you can start writing code to pull out and count specific details that interest you, rather than counting by hand.

Two useful questions to answer programmatically—especially in a large file—are:

- Whether there are failed password attempts, and if so, how many were there across the file?
- Which source identifiers—hostnames, IPv4 or IPv6 addresses, or domain names—appear, and how often?

---

## The Counter That Stopped Being Enough

For this exercise, I used AI to generate a small synthetic authentication-log fixture called **auth.log**:

```text
  Oct 03 14:02:11 lab sshd[412]: Failed password for invalid user admin from 192.0.2.10 port 54122 ssh2
  Oct 03 14:02:15 lab sshd[419]: Accepted publickey for analyst from 192.0.2.20 port 49831 ssh2
  Oct 03 14:03:07 lab sshd[431]: Failed password for analyst from 192.0.2.10 port 54140 ssh2
  Oct 03 14:04:18 lab sudo[455]: pam_unix(sudo:session): session opened for user root
  Oct 03 14:05:42 lab sshd[477]: Failed password for invalid user test from 198.51.100.7 port 55301 ssh2
```

The first question that my C++ program **log-explorer** was intended to answer was:

*"How many failed password attempts are there in the provided file?"*

The program *can't* prove that a failed password attempt actually occurred. The narrower question it *can* answer is:

*"How many lines contain the exact, case-sensitive text `Failed password`?"*

Within this controlled fixture, every line intended to represent a failed password attempt contains the exact string `Failed password`, and none of the other fixture lines do. 

I can therefore read the file one line at a time and increment an integer whenever the current line contains that marker:

```cpp
std::ifstream file(path);
std::string line;
int failedAttempts = 0;

while (std::getline(file, line)) {
    if (line.find("Failed password") != std::string::npos) {
        failedAttempts += 1;
    }
}
```

That gives me one useful textual total:

```text
Failed SSH password attempts: 3
```

But it does not answer:

*"What were the sources of those attempts, and how many times did a given source appear within the file?"*

`failedAttempts` can represent one overall count, but it cannot retain a separate count for each extracted source token. 

It's just the wrong tool for that particular job!

---

## The Data Model Hiding Inside the Question

My first thought was:

*Do I need an array containing every different IP address, then search it for repeats?*

It's not the **worst idea**. A sequence can hold the source token extracted from each matching line, and I could search that sequence for repeats.

However, using an array also creates more decisions:

- Does one array store sources and another store counts?
- How do we keep their indexes synchronized so one source remains associated with its count?
- If I use a built-in fixed-size array, how large does it need to be for an unknown input file?
- How do I search for an existing source before deciding whether to add or increment it?

Arrays aren't bad, per se. They just don't directly describe what I need here: **an association between one identifier and one piece of state.**

What we're after is this, basically:

```text
  "192.0.2.10"   → 2
  "198.51.100.7" → 1
```

This is a **key-value pair**. The exact source token extracted from the line is the **key**, and its occurrence count is the **value**. At this point, the token is only text; I haven't validated it as an IP address or proven where an action actually came from.

But how do we *implement* that? We use a **map**!

```cpp
int failedAttempts = 0;
std::map<std::string, int> sourceCounts;

while (std::getline(file, line)) {
    // inspect the current line and update retained state
}
```

`failedAttempts` is one local integer holding the overall matching-line count. `sourceCounts` is a local map holding one integer for every unique `std::string` key.

The map is declared *before* the loop, so the same container survives across every line in the file. 

Declaring it *inside* the loop would create a **fresh** empty map for each line and discard the previous counts. When the file-processing function returns, both local variables are destroyed.

The map can now represent the result I want. The next problem is updating it correctly whether a source is appearing for the first time or already has a count.


## Killing Two Paths With One Line

These two lines appear after the parser has found the starting position and length of the source token:

```cpp

std::string source = line.substr(sourceStart, sourceLength);
sourceCounts[source] += 1;

```
These two lines of C++ are doing some solid work, so let's go through what they're doing:

- The first line copies `sourceLength` characters beginning at `sourceStart` into a string called `source`. 
- At this point, it is only extracted text—not a validated IP address or proof of where an event originated.
- The second line uses `source` as the key in `sourceCounts`. `operator[]` returns a reference to the integer mapped to that key, and `+= 1` modifies the stored value directly.

What happens if the key is *missing* for a given source?

Not to worry: `operator[]` inserts the key with `int`'s default value of `0`, and `+= 1` then changes that value to `1`.

What if a key already present in the map appears again?

Also no need to fret: `operator[]` accesses the *existing* integer associated with that key, and `+= 1` increments it. The second time a source token appears, its value changes from `1` to `2`.

That means `operator[]` is **not** a read-only lookup. Looking up a missing key inserts it and changes the map.

That specific behavior is actually really convenient here, because the program is intended to be a counter, so we *want* new tokens to get new entries and existing ones to get updated and not duplicated.

At this point, the map contains the state I wanted. The remaining problem is getting that state back out in a readable form.

---

## A Map Does Not Simply Print Itself

At this stage in the game, I had the actual information I wanted, but getting it out and formatted in a human-readable fashion was the last step.

I figured *"Well, I know `std::cout << "whatever you want to print to console" << '\n'` is how I print everything else, why wouldn't it work here?"*

So I typed out:

```cpp

std::cout << "Source counts: " << sourceCounts << '\n';

```

And wouldn't you know, it **didn't work here**. 

The clang compiler threw out the following error:

```text
 error: invalid operands to binary expression
  ('basic_ostream<...>' and 'std::map<std::string, int>')
```

Illuminating, I know.

What it's essentially saying is that C++ has no built-in way to print out a map in this way, like you would a string. It doesn't know what to do with separators, labels, any of that stuff.

We need to therefore try something different and break the task up into two pieces:

- Print out the "Source counts: " as a "heading" of sorts so the output is clear and legible.
- Loop through the map structure and print out each key-value pair, because that's the information we're after.

First piece of the puzzle is pretty simple, just print "Source counts:\n" to console.

```cpp

std::cout << "Source counts:\n";

```

The second piece of the puzzle requires using a for loop and a new piece of C++ syntax I learned doing this specific task!

```cpp

for (const auto& entry : sourceCounts) {
    std::cout << entry.first << ": " << entry.second << '\n';
}

```

**auto** was a really cool new piece of syntax I learned to add to a range-based for loop. It asks the C++ compiler to determine the element's type at compilation time rather than having to specify it myself.

The **&** makes the entry refer to the *actual entry* in the `sourceCounts` map, rather than copying that key-value pair into the loop variable.

The **const** makes that reference read-only, which fits because this loop only prints the completed map.

Together, the loop reads as:

*"For each read-only entry already stored in `sourceCounts`, do the following."*

`entry.first` is the source *key*, and `entry.second` is its count *value*.

The instructions within the loop are just locking in the format that will print to console:

```cpp

std::cout << entry.first << ": " << entry.second << '\n';

```

Print out the source key, then a colon directly after, then the value, then a newline.

Rinse and repeat till you've iterated over the whole map.

The output looks like this when you run the whole program:

```text

Failed SSH password attempts: 3
Source counts:
192.0.2.10: 2
198.51.100.7: 1

```

Because `std::map` iterates in key order, this output is deterministic rather than dependent on the order the sources appeared in the file. I verified that separately with reverse-order input and still received sorted output.

We've translated the log output from the start into useful information I could absolutely use to do further investigations on.

It seems trivial now, but you have to remember that most log files have **thousands** of entries, not 4 or 5. 

You can quickly see how working out how to pull things like this out of files programmatically pays off *fast*.

This output proves that three lines contained the exact text `Failed password`, that two of those matching lines yielded the token `192.0.2.10`, and that one yielded `198.51.100.7`.

It does **not prove** that the file is authentic, that any of this activity is malicious, nor does it prove that these are even validated IP addresses. 

It is crucially important to remember when you're investigating things, that your claims remain bounded to what the evidence proves, lest you go down a rabbit hole that leads you nowhere.

The focused mechanism and verified example now live in my [Technical Cabinet](/cabinet/cpp/maps/).
