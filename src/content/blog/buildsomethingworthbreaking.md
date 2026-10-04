---
title: "Learning The Low-Level Stuff : Building Something Worth Breaking"
description: "A deliberately vulnerable C++ app became my training ground for low-level security and reverse engineering"
pubDate: "Sep 04 2026"
slug: "building-something-worth-breaking"
heroImage: "/imagesforarticles/ghidra-reverse-engineering-tool.png"
---

### Introduction

I started a new job at a defensive cybersecurity company after over half a decade plying my trade in various offensive security roles. It's done something I wasn't really expecting: <em>it's made me want to get my hands dirty again.</em>

The better I understand the field — the products, the architectures I work with, but also what’s <strong>actually happening</strong> underneath them — the better I can be at my job. 
That’s turned into a fairly simple ambition: learn as much of the technical side of security as I reasonably can, particularly the areas where I’ve historically had less depth. 

And apparently the part of my brain that really wanted feeding was the low-level stuff - debuggers, memory, binaries, assembly, reverse engineering, vulnerability research.

These are the kinds of things where eventually you stop looking at what software <strong>claims</strong> it’s doing and start looking at what the machine is <strong>actually</strong> doing.

The problem is that reverse engineering has a pretty brutal on-ramp. If you start with a completely unfamiliar binary, you’re potentially trying to learn assembly, calling conventions, debugger navigation, compiler behavior and somebody else’s program logic at the same time.

So I decided to remove at least <em>one</em> of those variables. I built my first binary myself.

Enter <strong>Workweek: The HR System for Scoundrels and Villains of All Stripes.</strong>

---

### Why Do This To Myself, I Hear You Ask?

Well, dismbodied reader's voice - good question!

The real reason is that RE and learning it from scratch has a notoriously vicious initial learning curve, and I didn't want my first target to be completely opaque. Quite the opposite, actually.

I figured if I wrote the program myself, knew how the functions were meant to work, and put the vulnerablities in <em>myself</em> - then finding them in a debugger would be that much easier.

C++ made sense because its:

- something I use for game-dev projects outside of work, 
- something that sits in exactly the territory I wanted to explore: manual memory concerns, integer widths, low-level behavior, compiled native binaries,
- gives you enough rope to make bad decisions in interesting ways.

The goal wasn’t and isn't to become a C++ expert or a professional software developer. 

Instead, it was to build something small enough that I understood the source code cold, then later remove the source and see whether I could recover that understanding from the binary.

The result was <strong>Workweek</strong>, a deliberately vulnerable command-line HR system for fantasy villains, because I'm an incurable dork.

I kept the scope intentionally small and chose four different bug classes:
- a stack buffer overflow using an unsafe copy into a fixed-size buffer,
- unsafe path handling that allows access outside the intended document directory,
- an integer-width bug in payroll logic,
- an authorization flaw where the program trusts the wrong user context.

That gave me four different kinds of failure to investigate without turning the C++ part into a six-month software project.

Plus, it was just a blast to do because it was connected directly to the nerdy shit I love.

---

#### Vulnerability 1: The Stack Buffer Overflow

![mainmenu](/imagesforarticles/workweekmainmenu.png)

Once a user has logged in to Workweek, they're presented with a main menu where they can choose from one of four functions:

- Looking up an employee record,
- Looking up a company document,
- Reading pay information and making an adjustment to said pay,
- Exiting the program.

The first vulnerability I wanted to work on lies within option 1: <strong>looking up an employee record.</strong>

![opt1](/imagesforarticles/workweekopt1.png)

This functionality is pretty simple: you enter the ID of the employee whose data you want to lookup. 

Then, Workweek prints the contents to console, extracts the name of the employee whose data you've read into a std::string, and then copies it into a fixed-size "backup" buffer.

This is about when I found out: it's <em>way harder</em> to intentionally write unsafe code than you'd initially think. A lot of the language is trying to stop you doing dumb shit by default these days.

I had to actively <strong>decide</strong> to implement an unsafe bit of code to create this vulnerability, which you can see below:

```c++
char employeeNameBackup[16];
std::strcpy(employeeNameBackup, employeeName.c_str());
```

The buffer I created (employeeNameBackup) has room to store 16 bytes of information, because that's how large I decided to make it.

The function I'm using to do the copying <em>into that buffer</em> (std::strcpy) is from the C++ standard library. The fun part is that strcpy does not care one bit about how much space is <strong>in</strong> the buffer, nor does it care how much space is <strong>left</strong> in said buffer.

Strcpy just copies bytes into the destination until it reaches the source's <strong> null terminator</strong>, which is just the null byte (\0) that marks the end of a C-style string. Null terminator bytes are what tells C++ that the string has "ended" and it can therefore move on to other things.

Let's pretend that the developer (me) doesn't really know what he's doing (an enormous leap, I know) and was using the employeeNameBackup buffer to store the name of the employee being looked up in case Workweek crashed. 
As long as the employee's name being stored is <strong>less than 16 bytes</strong>, this is entirely legitimate and working functionality.

Unsafe, to be sure. But it <em>does work.</em>

Enter our newest and most tentacled employee: Emrakuul, the Aeons Torn.

![opt1](/imagesforarticles/emrakuul.png)

I've been playing Magic: The Gathering for about 15 years now and I absolutely love both the game and the surrounding lore. 

In Magic's universe, Emrakul is one of the titans of the Eldrazi, an unknowable eldtrich race of beings that destroy and warp reality as they touch it.

I could not resist making the specific record that broke the employee lookup function an Eldrazi famous for warping things and breaking anything she comes into contact with.

Especially because her card literally says she can't be countered.

I also picked her because her card's name "Emrakul, the Aeons Torn" is <strong>deliberately longer than 16 bytes.</strong>

Let's log in as our best be-tentacled gal and see what happens:

![opt1](/imagesforarticles/workweekemrakul.png)

It <em>looks</em> like nothing has happened at all.

Authentication went off without a hitch, I asked to see Emrakul's record and it showed me it. All is bueno in the neighborhood. 

<em>Or, is it?</em>

The fun truly starts when you load up Workweek in a debugger and see what happens when you do this again. I'm using the native MacOS debugger LLDB, because I'm using a Macbook Pro M1 2021.

Before we do that, though, let's take a look at the code that just executed:

```c++
void lookupEmployee(const std::string& currentUserID) {
    std::string employeeID;
    std::string employeeName;

    // ...

    while (std::getline(file, line)) {
        if (line.rfind("Password:", 0) == 0) {
            continue;
        }

        std::cout << line << '\n';

        // [1] Employee name is read into a dynamically-sized std::string.
        if (line.rfind("Name:", 0) == 0) {
            employeeName = line.substr(6);
        }
    }

    // [2] A fixed-size 16-byte stack buffer is created.
    char employeeNameBackup[16];

    // [3] strcpy copies the entire C-string without knowing
    //     how large employeeNameBackup actually is.
    std::strcpy(employeeNameBackup, employeeName.c_str());
}
```

Comment number [1] is right next to where we read the name of the employee into a std::string called <strong>employeeName</strong>. Std::strings are <strong>dynamically sized</strong>, so Workweek can happily go about storing a name longer than 16 characters, like "Emrakul, the Aeons Torn" which is that value for eldrazi_001.

Comment number [2] is right above the <strong>fixed-size destination</strong> that we're going to store that name in. It's <strong>16 bytes of space</strong> and that's the hard boundary on the stack that we're about to violate.

Comment number [3] is a function <strong>std::strcpy</strong> we're using that is a <strong>deliberately unsafe</strong> way to copy that name from employeeName (the string, longer than 16 bytes) into employeeNameBackup (the buffer that's 16 bytes long). Strcpy is going to copy bytes until it encounters the string's null terminator byte (\0) that tells it to stop.

Let's do some quick math:

```c++
"Emrakuul, the Aeons Torn" = 24 characters

Null terminator           =  1 byte

                             --------

Total copied              = 25 bytes

Destination               = 16 bytes

Overflow                  =  9 bytes
```

In a real application, an out-of-bounds write like this can corrupt nearby stack data and potentially alter how the program behaves. In the worst case, a well-controlled overflow can be turned into control-flow hijacking or code execution.

For Workweek, though - I just wanted to see the memory corruption itself happen in real-time, so I fired up LLDB and set the breakpoint (a direct "stop here" instruction to the debugger) to just before the strcpy executes:

![opt1](/imagesforarticles/lldbvuln1atbreak.png)

To make things Swarovski-clear: Workweek is about to extract a <strong>24-character</strong> employee name. The next operation will copy that name, plus its null terminator, into a <strong>16-byte</strong> stack buffer.

Now the program is at the strcpy function, let's take a look at the exact memory boundary we're trying to overflow:

![opt1](/imagesforarticles/lldbvuln1beforestrcpy.png)

There's a few parts of this that I want to direct your attention to:

- <strong>frame variable employeeName</strong> is a command that roughly tells me what the current value of employeeName is within this function. It proves that the functions <em>knows</em> I want to lookup Emrakul's file.
- <strong>p &employeeNameBackup</strong> is a command telling LLDB to print the address of our employeeNameBackup variable in my Mac's memory. It'll almost certainly be different if you ran this on your computer.
- You can see that the response is as follows: <strong>(char (*)[16]) 0x000000016fdfe6d8</strong>
- This means that our buffer begins at the memory address 0x000000016fdfe6d8. <strong> That's the start of our boundary.</strong>

Our buffer BEGINS at: <strong>0x16fdfe6d8</strong>

Our 16-byte buffer RUNS from this address to this address:  <strong>0x16fdfe6d8 – 0x16fdfe6e7</strong>

Any overflow starts at this address: <strong>0x16fdfe6e8</strong>

Also, look at line 129:
strcpy has no destination-size argument. It copies until \0. There's our fatal flaw.

Let's execute the strcpy and see if we've written anything past <strong>0x16fdfe6e7</strong>.
If we have, that's our stack buffer overflow in action.

![opt1](/imagesforarticles/lldbvuln1afterstrcpy.png)

Let's inspect that same region of my Mac's memory <em>after the strcpy.</em> and after I forgot how to spell "memory" for a sec.

The 8 bytes following the <strong>start address 0x16fdfe6d8</strong> are:  45 6d 72 61 6b 75 75 6c

The <em>next</em> 8 bytes, the other half of our <strong>16-byte</strong> buffer starting at 0x16fdfe6e0 are: 2c 20 74 68 65 20 41 65

Translated back into letters you and I can read easily, those 16 bytes decode to: <strong>Emrakuul, the Ae</strong>

Cast your eyes to the row starting 0x16fdfe6e8: 6f 6e 73 20 54 6f 72 6e

Decoded back into English, this reads:

```c++
6f 6e 73 20 54 6f 72 6e
 o  n  s     T  o  r  n
```

Remember, the buffer we set up (employeeNameBackup) ended ONE BYTE EARLIER.

This means that our employeeName std::string has overrun the end of the 16-byte buffer and overwritten the memory address next to it. 

If you want belt-and-braces confirmation it worked, look at the command at the bottom of the screenshot.

<strong>memory read --format c --size 1 --count 25 0x000000016fdfe6d8</strong> is telling LLDB to basically print out character by character what is in the 25 bytes following 0x000000016fdfe6d8.

The legitimate buffer contains "Emrakuul, the Ae". 

The remaining "ons Torn\0" starts at 0x16fdfe6e8, the first address outside the buffer. 

<strong>Nine bytes</strong> have been written out of bounds.

That's a successful stack buffer overflow, my friends.

---

#### Vulnerabilities 2/3/4: Your Turn, Friends!

I’ve deliberately only walked through <strong>one</strong> of Workweek’s vulnerabilities here.

The application also contains some deeply questionable:
- integer handling, 
- authorization logic,
- file/path handling. 

I’m not going to explain exactly where those problems are, how they behave, or even whether my description of them is entirely trustworthy.

That would ruin the fun.

Workweek is deliberately small enough that you can read the code, compile it yourself, throw it into LLDB, Ghidra or radare2, and start poking at it same-day.

If you want to see whether you can find the remaining problems — and prove that they’re actually problems rather than just taking my word for it — the whole thing is on GitHub:

[Workweek on GitHub](https://github.com/jawndeere-sec/workweek)

Break it. Debug it. Reverse it. Make the goblins richer.

Let the dork flow through you.














