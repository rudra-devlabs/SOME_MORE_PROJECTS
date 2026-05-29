h = int(input("Enter height: "))

stars = 1
spaces = h-1
for i in range(h+1):
    for j in range(spaces):
        print(" ", end="")
    for k in range(stars):
        print("*", end="")
    stars += 2
    spaces -= 1
    print()